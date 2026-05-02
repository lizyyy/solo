from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Instrument(Base):
    """共享仪器信息"""
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, index=True)
    instrument_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    
    hourly_rate = Column(Float, default=0.0)
    overtime_rate = Column(Float, default=0.0)
    max_reservation_hours = Column(Integer, default=8)
    
    is_active = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    reservations = relationship("Reservation", back_populates="instrument")
    swipe_logs = relationship("SwipeLog", back_populates="instrument")
    billing_rules = relationship("BillingRule", back_populates="instrument")
