from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.session import TrainingSession
from app.models.trade import Trade
from app.core.security import get_current_user

router = APIRouter(prefix="/statistics", tags=["统计"])

@router.get("/session/{session_id}", response_model=dict)
async def get_session_statistics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取场次统计"""
    result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session or session.user_id != current_user.id:
        return {"code": 404, "message": "场次不存在"}
    
    # 获取所有交易
    trades_result = await db.execute(
        select(Trade).where(Trade.session_id == session_id, Trade.status == "closed")
    )
    trades = trades_result.scalars().all()
    
    # 计算统计
    total_trades = len(trades)
    winning_trades = sum(1 for t in trades if t.pnl > 0)
    total_pnl = sum(t.pnl for t in trades)
    avg_pnl = total_pnl / total_trades if total_trades > 0 else 0
    win_rate = winning_trades / total_trades * 100 if total_trades > 0 else 0
    
    # 盈亏比
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [abs(t.pnl) for t in trades if t.pnl < 0]
    avg_win = sum(wins) / len(wins) if wins else 0
    avg_loss = sum(losses) / len(losses) if losses else 1
    profit_factor = avg_win / avg_loss if avg_loss > 0 else 0
    
    # 收益曲线
    equity_curve = []
    capital = session.initial_capital
    for trade in sorted(trades, key=lambda x: x.exit_index):
        capital += trade.pnl
        equity_curve.append({"index": trade.exit_index, "capital": round(capital, 2)})
    
    return {
        "code": 200,
        "message": "success",
        "data": {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "losing_trades": total_trades - winning_trades,
            "win_rate": round(win_rate, 2),
            "total_pnl": round(total_pnl, 2),
            "avg_pnl": round(avg_pnl, 2),
            "profit_factor": round(profit_factor, 2),
            "max_drawdown": session.max_drawdown,
            "final_capital": round(session.current_capital, 2),
            "equity_curve": equity_curve
        }
    }
