from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import date, datetime
import uuid

from app.database import get_db
from app.models.user import User
from app.models.symbol import Symbol
from app.models.session import TrainingSession
from app.models.trade import Trade
from app.core.security import get_current_user
from app.api.kline import get_single_bar

router = APIRouter(prefix="/sessions", tags=["训练场次"])

class SessionCreate(BaseModel):
    symbol_id: int
    period: str = "daily"
    mode: str = "sequential"
    start_date: str
    end_date: str
    initial_capital: float = 100000.0

class SessionResponse(BaseModel):
    id: str
    symbol_id: int
    current_index: int
    status: str
    current_capital: float
    total_trades: int

async def check_sl_tp_triggers(
    session: TrainingSession,
    bar: dict,
    db: AsyncSession,
) -> list:
    """
    Check all open trades for stop-loss / take-profit triggers against the current bar.

    Returns list of triggered trades with trigger reason and P&L.
    """
    result_active = await db.execute(
        select(Trade).where(
            Trade.session_id == session.id,
            Trade.status == "open",
        )
    )
    open_trades = result_active.scalars().all()

    triggered = []
    bar_high = bar.get("high", 0)
    bar_low = bar.get("low", 0)
    bar_close = bar.get("close", 0)

    for trade in open_trades:
        trigger_reason = None
        exit_price = None

        if trade.direction == "long":
            # 做多：止损价被向下突破，止盈价被向上突破
            if trade.stop_loss and bar_low <= trade.stop_loss:
                exit_price = trade.stop_loss
                trigger_reason = "sl"
            elif trade.take_profit and bar_high >= trade.take_profit:
                exit_price = trade.take_profit
                trigger_reason = "tp"
        else:
            # 做空：止损价被向上突破，止盈价被向下突破
            if trade.stop_loss and bar_high >= trade.stop_loss:
                exit_price = trade.stop_loss
                trigger_reason = "sl"
            elif trade.take_profit and bar_low <= trade.take_profit:
                exit_price = trade.take_profit
                trigger_reason = "tp"

        if trigger_reason:
            pnl = (
                (exit_price - trade.entry_price) * trade.quantity
                if trade.direction == "long"
                else (trade.entry_price - exit_price) * trade.quantity
            )
            pnl_ratio = pnl / (trade.entry_price * trade.quantity) * 100 if trade.entry_price else 0

            trade.exit_price = exit_price
            trade.exit_time = datetime.utcnow()
            trade.exit_index = session.current_index + 1
            trade.status = "closed"
            trade.pnl = pnl
            trade.pnl_ratio = pnl_ratio
            trade.reason = trigger_reason

            session.current_capital += pnl
            session.total_pnl += pnl
            if pnl > 0:
                session.winning_trades += 1

            triggered.append({
                "trade_id": trade.id,
                "direction": trade.direction,
                "reason": trigger_reason,
                "exit_price": exit_price,
                "pnl": round(pnl, 2),
                "pnl_ratio": round(pnl_ratio, 2),
                "entry_price": trade.entry_price,
            })

    if triggered:
        await db.commit()

    return triggered


@router.post("/", response_model=dict)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_session = TrainingSession(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        symbol_id=session_data.symbol_id,
        period=session_data.period,
        mode=session_data.mode,
        start_date=datetime.strptime(session_data.start_date, "%Y-%m-%d").date(),
        end_date=datetime.strptime(session_data.end_date, "%Y-%m-%d").date(),
        initial_capital=session_data.initial_capital,
        current_capital=session_data.initial_capital,
        status="active",
        current_index=0
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    return {"code": 200, "message": "创建成功", "data": {"id": new_session.id}}

@router.get("/{session_id}", response_model=dict)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(TrainingSession).where(
            TrainingSession.id == session_id,
            TrainingSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="训练场次不存在")

    return {
        "code": 200,
        "message": "success",
        "data": {
            "id": session.id,
            "symbol_id": session.symbol_id,
            "period": session.period,
            "mode": session.mode,
            "current_index": session.current_index,
            "status": session.status,
            "current_capital": session.current_capital,
            "total_trades": session.total_trades,
            "total_pnl": session.total_pnl
        }
    }

@router.post("/{session_id}/next", response_model=dict)
async def next_bar(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """推进到下一根K线，并检查止损/止盈触发"""
    result = await db.execute(
        select(TrainingSession).where(
            TrainingSession.id == session_id,
            TrainingSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="训练场次不存在")

    # 获取品种信息
    symbol_result = await db.execute(select(Symbol).where(Symbol.id == session.symbol_id))
    symbol = symbol_result.scalar_one_or_none()

    if not symbol:
        raise HTTPException(status_code=404, detail="品种不存在")

    # 获取下一根K线
    try:
        kline_data = await get_single_bar(symbol.symbol_code, session.current_index + 1, session.period)
    except HTTPException:
        raise HTTPException(status_code=400, detail="已到达数据末尾")

    bar = kline_data["data"]

    # 更新索引
    session.current_index += 1
    await db.commit()

    # 检查止损/止盈触发
    sl_tp_triggers = await check_sl_tp_triggers(session, bar, db)

    response_data = {
        "index": session.current_index,
        "bar": bar,
    }

    if sl_tp_triggers:
        response_data["sl_tp_triggers"] = sl_tp_triggers

    return {
        "code": 200,
        "message": "success",
        "data": response_data,
    }

async def calculate_session_stats(session_id: str, db: AsyncSession):
    """计算场次统计"""
    from sqlalchemy import func

    result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        return None

    trades_result = await db.execute(
        select(Trade).where(Trade.session_id == session_id, Trade.status == "closed")
    )
    trades = trades_result.scalars().all()

    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t.pnl > 0)
    total_pnl = sum(t.pnl for t in trades)

    return {
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(winning_trades / total_trades * 100, 2) if total_trades > 0 else 0
    }

@router.post("/{session_id}/complete", response_model=dict)
async def complete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """完成训练"""
    result = await db.execute(
        select(TrainingSession).where(
            TrainingSession.id == session_id,
            TrainingSession.user_id == current_user.id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="训练场次不存在")

    session.status = "completed"
    session.ended_at = datetime.utcnow()
    await db.commit()

    # 计算统计
    stats = await calculate_session_stats(session_id, db)

    return {"code": 200, "message": "训练完成", "data": stats}
