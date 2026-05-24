from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default="pending", index=True)
    line_section = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_cross_day = Column(Boolean, default=False)
    work_summary = Column(Text)
    applicant = Column(String)
    applicant_department = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    idempotency_key = Column(String, index=True)
    batch_id = Column(String, index=True)
    final_conclusion = Column(Text)
    closed_at = Column(DateTime)
    source_system = Column(String)
    version = Column(Integer, default=1)
