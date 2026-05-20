from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.database import get_db
from app.models.user import User
from app.models.session import TrainingSession
from app.models.trade import Trade
from app.models.symbol import Symbol
from app.core.security import get_current_user
from app.api.kline import get_single_bar

router = APIRouter(prefix="/trades", tags=["交易"])

class TradeOpen(BaseModel):
    session_id: str
    direction: str  # long / short
    quantity: float = 1.0
    stop_loss: float = None
    take_profit: float = None

class TradeClose(BaseModel):
    exit_price: float = None  # None表示市价平仓

@router.post("/", response_model=dict)
async def open_position(
    trade_data: TradeOpen,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """开仓"""
    # 获取场次
    result = await db.execute(select(TrainingSession).where(TrainingSession.id == trade_data.session_id))
    session = result.scalar_one_or_none()
    
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="训练场次不存在")
    
    # 获取当前K线价格
    symbol_result = await db.execute(select(Symbol).where(Symbol.id == session.symbol_id))
    symbol = symbol_result.scalar_one_or_none()
    
    if not symbol:
        raise HTTPException(status_code=404, detail="品种不存在")
    
    kline_data = await get_single_bar(symbol.symbol_code, session.current_index, session.period)
    current_price = kline_data["data"]["close"]
    
    # 创建交易记录
    new_trade = Trade(
        id=str(uuid.uuid4()),
        session_id=session.id,
        symbol_id=session.symbol_id,
        direction=trade_data.direction,
        entry_price=current_price,
        quantity=trade_data.quantity,
        stop_loss=trade_data.stop_loss,
        take_profit=trade_data.take_profit,
        entry_time=datetime.utcnow(),
        entry_index=session.current_index,
        status="open"
    )
    db.add(new_trade)
    
    # 更新场次交易数
    session.total_trades += 1
    await db.commit()
    await db.refresh(new_trade)
    
    return {"code": 200, "message": "开仓成功", "data": {"id": new_trade.id, "entry_price": new_trade.entry_price}}

@router.post("/{trade_id}/close", response_model=dict)
async def close_position(
    trade_id: str,
    close_data: TradeClose,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """平仓"""
    result = await db.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    
    if not trade:
        raise HTTPException(status_code=404, detail="交易记录不存在")
    
    # 验证用户权限
    session_result = await db.execute(select(TrainingSession).where(TrainingSession.id == trade.session_id))
    session = session_result.scalar_one_or_none()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权操作")
    
    # 获取平仓价格
    if close_data.exit_price is None:
        symbol_result = await db.execute(select(Symbol).where(Symbol.id == trade.symbol_id))
        symbol = symbol_result.scalar_one_or_none()
        if not symbol:
            raise HTTPException(status_code=404, detail="品种不存在")
        kline_data = await get_single_bar(symbol.symbol_code, session.current_index, session.period)
        exit_price = kline_data["data"]["close"]
    else:
        exit_price = close_data.exit_price
    
    # 计算盈亏
    if trade.direction == "long":
        pnl = (exit_price - trade.entry_price) * trade.quantity
    else:
        pnl = (trade.entry_price - exit_price) * trade.quantity
    
    pnl_ratio = pnl / (trade.entry_price * trade.quantity) * 100
    
    # 更新交易记录
    trade.exit_price = exit_price
    trade.exit_time = datetime.utcnow()
    trade.exit_index = session.current_index
    trade.status = "closed"
    trade.pnl = pnl
    trade.pnl_ratio = pnl_ratio
    trade.reason = "manual"
    
    # 更新资金
    session.current_capital += pnl
    session.total_pnl += pnl
    
    # 更新胜率
    if pnl > 0:
        session.winning_trades += 1
    
    await db.commit()
    
    return {
        "code": 200,
        "message": "平仓成功",
        "data": {
            "pnl": pnl,
            "pnl_ratio": pnl_ratio,
            "exit_price": exit_price
        }
    }

@router.get("/active", response_model=dict)
async def get_active_positions(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取当前持仓"""
    # 验证session属于当前用户
    session_result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
    session = session_result.scalar_one_or_none()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="训练场次不存在")
    
    result = await db.execute(
        select(Trade).where(
            Trade.session_id == session_id,
            Trade.status == "open"
        )
    )
    trades = result.scalars().all()
    
    return {
        "code": 200,
        "message": "success",
        "data": {
            "positions": [
                {
                    "id": t.id,
                    "direction": t.direction,
                    "entry_price": t.entry_price,
                    "quantity": t.quantity,
                    "stop_loss": t.stop_loss,
                    "take_profit": t.take_profit,
                    "entry_time": t.entry_time.isoformat(),
                    "entry_index": t.entry_index
                }
                for t in trades
            ]
        }
    }
