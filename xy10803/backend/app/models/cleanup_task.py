from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import BaseModel


class CleanupTask(BaseModel):
    __tablename__ = "cleanup_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    sandbox_id = Column(Integer, ForeignKey("tenant_sandboxes.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("seed_batches.id"), nullable=True)
    status = Column(String(50), default="pending")
    cleanup_type = Column(String(50), default="rollback")
    cleanup_strategy = Column(JSON, default=dict)
    executed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    result_summary = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)
    
    sandbox = relationship("TenantSandbox")
    batch = relationship("SeedBatch")
