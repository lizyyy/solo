from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import BaseModel


class SeedLog(BaseModel):
    __tablename__ = "seed_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("seed_batches.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("data_templates.id"), nullable=False)
    action = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    sql_executed = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, default=0)
    
    batch = relationship("SeedBatch")
    template = relationship("DataTemplate")
