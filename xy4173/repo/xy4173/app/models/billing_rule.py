from datetime import datetime, time
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Time
from sqlalchemy.orm import relationship
from app.core.database import Base


class BillingRule(Base):
    """计费规则"""
    __tablename__ = "billing_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    
    instrument_id = Column(Integer, ForeignKey("instruments.id"), nullable=True)
    research_group_id = Column(Integer, ForeignKey("research_groups.id"), nullable=True)
    
    base_hourly_rate = Column(Float, default=0.0)
    
    overtime_rate_multiplier = Column(Float, default=1.5)
    overtime_start_hours = Column(Integer, default=0)
    
    night_rate_multiplier = Column(Float, default=1.0)
    night_start_time = Column(Time, default=time(22, 0))
    night_end_time = Column(Time, default=time(6, 0))
    
    weekend_rate_multiplier = Column(Float, default=1.5)
    
    discount_rate = Column(Float, default=1.0)
    discount_reason = Column(Text, nullable=True)
    
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    instrument = relationship("Instrument", back_populates="billing_rules")
