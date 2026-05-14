from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import BaseModel


class SeedBatch(BaseModel):
    __tablename__ = "seed_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), nullable=False, unique=True, index=True)
    sandbox_id = Column(Integer, ForeignKey("tenant_sandboxes.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("data_templates.id"), nullable=False)
    status = Column(String(50), default="pending")
    parameters = Column(JSON, default=dict)
    result_summary = Column(JSON, default=dict)
    executed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    is_idempotent = Column(Integer, default=0)
    
    sandbox = relationship("TenantSandbox")
    template = relationship("DataTemplate")
