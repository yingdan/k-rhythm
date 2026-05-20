from sqlalchemy import Column, String, DateTime, Date, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class TrainingSession(Base):
    __tablename__ = "training_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)
    period = Column(String(20), default="daily")  # daily/weekly/monthly/60min
    mode = Column(String(20), default="sequential")  # sequential/random
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    current_index = Column(Integer, default=0)
    initial_capital = Column(Float, default=100000.0)
    current_capital = Column(Float, default=100000.0)
    status = Column(String(20), default="active")  # active/paused/completed
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    total_pnl = Column(Float, default=0.0)
    max_drawdown = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="sessions")
    symbol = relationship("Symbol", back_populates="sessions")
    trades = relationship("Trade", back_populates="session", cascade="all, delete-orphan")
