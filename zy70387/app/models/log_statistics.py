from sqlalchemy import Column, Integer, String, DateTime, Date, Index
from datetime import datetime

from app.models.database import Base


class LogStatistics(Base):
    __tablename__ = "log_statistics"

    id = Column(Integer, primary_key=True, index=True)
    stat_date = Column(Date, nullable=False, index=True)
    
    tenant_id = Column(String(50), nullable=False, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    
    total_logs = Column(Integer, nullable=False, default=0)
    sampled_logs = Column(Integer, nullable=False, default=0)
    dropped_logs = Column(Integer, nullable=False, default=0)
    duplicate_logs = Column(Integer, nullable=False, default=0)
    
    failure_logs = Column(Integer, nullable=False, default=0)
    failure_context_logs = Column(Integer, nullable=False, default=0)
    
    rule_id = Column(Integer, nullable=True, index=True)
    rule_version = Column(Integer, nullable=True, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_log_stats_date_tenant_type', 'stat_date', 'tenant_id', 'task_type', unique=True),
    )
