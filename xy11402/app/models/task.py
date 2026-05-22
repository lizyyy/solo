from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.enums import TaskStatus, TaskSource, RetryCategory


class CompensationTask(Base):
    __tablename__ = "compensation_tasks"

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True, nullable=False)
    task_no = Column(String, unique=True, index=True)
    source = Column(String, nullable=False)
    status = Column(String, default=TaskStatus.PENDING, nullable=False)
    retry_count = Column(Integer, default=0)
    max_retry_count = Column(Integer, default=3)
    retry_category = Column(String)
    last_error = Column(Text)
    next_retry_at = Column(DateTime)
    box_no = Column(String, index=True)
    driver_id = Column(String)
    temperature_record_id = Column(String)
    compensation_amount = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime)
    closed_at = Column(DateTime)

    evidences = relationship("OriginalEvidence", back_populates="task", cascade="all, delete-orphan")
    status_logs = relationship("StatusLog", back_populates="task", cascade="all, delete-orphan")


class OriginalEvidence(Base):
    __tablename__ = "original_evidences"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("compensation_tasks.id"), nullable=False)
    source_file = Column(String, nullable=False)
    source_row_no = Column(Integer)
    original_value = Column(Text, nullable=False)
    parsed_value = Column(Text)
    field_name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("CompensationTask", back_populates="evidences")


class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("compensation_tasks.id"), nullable=False)
    from_status = Column(String)
    to_status = Column(String, nullable=False)
    operation_type = Column(String, nullable=False)
    operator = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("CompensationTask", back_populates="status_logs")
