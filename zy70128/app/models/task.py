import enum
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON, Boolean
from app.models.base import BaseModel


class TaskStatus(enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class BackgroundTask(BaseModel):
    """后台任务"""

    __tablename__ = "background_tasks"

    task_type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default=TaskStatus.PENDING.value, index=True)
    task_key = Column(String(255), nullable=True, index=True)
    priority = Column(Integer, default=0, nullable=False)
    parameters = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    error_stacktrace = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(String(100), nullable=True)
    created_by = Column(String(100), nullable=True)
    last_error_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    progress_percent = Column(Integer, default=0, nullable=False)
    progress_message = Column(String(500), nullable=True)
