from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class TaskBatch(Base):
    __tablename__ = "task_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    task_type = Column(String(50), index=True)
    total_tasks = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, default=dict)

    failure_reasons = relationship("FailureReason", back_populates="batch")
    rerun_budgets = relationship("RerunBudget", back_populates="batch")
    rejection_records = relationship("RejectionRecord", back_populates="batch")
    rerun_summaries = relationship("RerunSummary", back_populates="batch")


class FailureReason(Base):
    __tablename__ = "failure_reasons"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    reason_code = Column(String(50), index=True, nullable=False)
    reason_message = Column(Text)
    count = Column(Integer, default=1)
    first_failed_at = Column(DateTime, default=datetime.utcnow)
    last_failed_at = Column(DateTime, default=datetime.utcnow)
    task_ids = Column(JSON, default=list)

    batch = relationship("TaskBatch", back_populates="failure_reasons")


class RerunBudget(Base):
    __tablename__ = "rerun_budgets"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    reason_code = Column(String(50), index=True, nullable=False)
    budget_window_hours = Column(Integer, default=24)
    max_reruns = Column(Integer, default=3)
    used_reruns = Column(Integer, default=0)
    window_start = Column(DateTime, default=datetime.utcnow)
    window_end = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("TaskBatch", back_populates="rerun_budgets")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.window_end is None:
            self.window_end = self.window_start + timedelta(hours=self.budget_window_hours)


class RejectionRecord(Base):
    __tablename__ = "rejection_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    reason_code = Column(String(50), index=True)
    rejection_reason = Column(String(200), nullable=False)
    original_request = Column(JSON)
    processing_context = Column(JSON)
    rejected_at = Column(DateTime, default=datetime.utcnow)
    rejected_by = Column(String(50), default="system")

    batch = relationship("TaskBatch", back_populates="rejection_records")


class RerunSummary(Base):
    __tablename__ = "rerun_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"))
    reason_code = Column(String(50), index=True)
    rerun_number = Column(Integer, default=1)
    status = Column(String(20), default="initiated")
    initiated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    tasks_submitted = Column(Integer, default=0)
    tasks_succeeded = Column(Integer, default=0)
    tasks_failed = Column(Integer, default=0)
    result_metadata = Column(JSON, default=dict)

    batch = relationship("TaskBatch", back_populates="rerun_summaries")
