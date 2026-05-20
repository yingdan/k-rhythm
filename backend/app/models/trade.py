from sqlalchemy import Column, String, DateTime, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("training_sessions.id"), nullable=False)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)
    direction = Column(String(10), nullable=False)  # long / short
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    quantity = Column(Float, default=1.0)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    entry_index = Column(Integer, nullable=False)
    exit_index = Column(Integer, nullable=True)
    status = Column(String(20), default="open")  # open/closed/stopped
    pnl = Column(Float, default=0.0)
    pnl_ratio = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    reason = Column(String(20), nullable=True)  # manual/sl/tp/end
    created_at = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("TrainingSession", back_populates="trades")
    symbol = relationship("Symbol", back_populates="trades")
