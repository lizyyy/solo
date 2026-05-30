from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship

from .base import BaseModel


class EstimationReport(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    params_version = Column(Integer, nullable=False, default=1)
    estimation_id = Column(Integer, ForeignKey("supportestimation.id"))

    report_type = Column(String(50), nullable=False, default="full")
    format = Column(String(20), nullable=False, default="json")
    file_path = Column(String(500))
    file_name = Column(String(255))

    summary = Column(JSON, default={})
    content = Column(JSON, default={})

    generated_by = Column(String(100))
    generation_time_ms = Column(Integer)
    is_latest = Column(Boolean, default=True)

    notes = Column(Text)

    task = relationship("EstimationTask", back_populates="reports")
    estimation = relationship("SupportEstimation")
