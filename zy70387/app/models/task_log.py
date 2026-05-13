from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), nullable=False, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    
    log_level = Column(String(20), nullable=False, default="INFO")
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    is_success = Column(Boolean, nullable=False, default=True)
    is_failure = Column(Boolean, nullable=False, default=False)
    
    is_sampled = Column(Boolean, nullable=False, default=False)
    is_failure_context = Column(Boolean, nullable=False, default=False)
    context_for_failure_id = Column(Integer, ForeignKey("task_logs.id"), nullable=True)
    
    rule_id = Column(Integer, ForeignKey("sampling_rules.id"), nullable=True)
    rule_version = Column(Integer, nullable=True, default=1)
    
    content_hash = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_task_logs_tenant_type', 'tenant_id', 'task_type'),
        Index('ix_task_logs_task_timestamp', 'task_id', 'timestamp'),
    )
    
    rule = relationship("SamplingRule", back_populates="logs")
