from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Symbol(Base):
    __tablename__ = "symbols"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol_code = Column(String(20), unique=True, nullable=False, index=True)  # 600000.SH / AAPL.US
    market = Column(String(10), nullable=False, index=True)  # cn / us
    name = Column(String(100), nullable=False)
    name_en = Column(String(100), nullable=True)
    sector = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)
    list_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    sessions = relationship("TrainingSession", back_populates="symbol")
    trades = relationship("Trade", back_populates="symbol")
