from sqlalchemy import Column, Integer, String, DateTime, Index
from datetime import datetime

from app.models.database import Base


class DroppedLog(Base):
    __tablename__ = "dropped_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    tenant_id = Column(String(50), nullable=False, index=True)
    task_type = Column(String(50), nullable=False, index=True)
    
    drop_reason = Column(String(50), nullable=False, index=True)
    drop_count = Column(Integer, nullable=False, default=0)
    
    rule_id = Column(Integer, nullable=True, index=True)
    rule_version = Column(Integer, nullable=True, default=1)
    
    drop_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('ix_dropped_logs_tenant_type_reason', 'tenant_id', 'task_type', 'drop_reason'),
    )
