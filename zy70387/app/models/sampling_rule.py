from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class SamplingRule(Base):
    __tablename__ = "sampling_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    task_type = Column(String(50), nullable=True, index=True)
    tenant_id = Column(String(50), nullable=True, index=True)
    
    is_vip_tenant = Column(Boolean, nullable=False, default=False)
    sample_rate = Column(Float, nullable=False, default=0.1)
    
    dedup_enabled = Column(Boolean, nullable=False, default=True)
    dedup_window_seconds = Column(Integer, nullable=False, default=300)
    
    context_window_before = Column(Integer, nullable=False, default=3)
    context_window_after = Column(Integer, nullable=False, default=1)
    
    retention_days = Column(Integer, nullable=False, default=7)
    
    priority = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    logs = relationship("TaskLog", back_populates="rule")
