import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    ABORTED = "aborted"


class LockStatus(str, enum.Enum):
    ACQUIRED = "acquired"
    RELEASED = "released"
    EXPIRED = "expired"
    FAILED = "failed"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text)
    max_execution_time = Column(Integer, default=300)
    heartbeat_interval = Column(Integer, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    locks = relationship("Lock", back_populates="task", cascade="all, delete-orphan")
    execution_logs = relationship("ExecutionLog", back_populates="task", cascade="all, delete-orphan")


class Lock(Base):
    __tablename__ = "locks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    instance_id = Column(String(255), nullable=False)
    status = Column(String(50), default=LockStatus.ACQUIRED)
    acquired_at = Column(DateTime(timezone=True), server_default=func.now())
    released_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), server_default=func.now())
    execution_window_start = Column(DateTime(timezone=True))
    execution_window_end = Column(DateTime(timezone=True))
    acquire_attempts = Column(Integer, default=1)
    failed_reason = Column(Text)

    task = relationship("Task", back_populates="locks")
    execution_logs = relationship("ExecutionLog", back_populates="lock")


class ExecutionLog(Base):
    __tablename__ = "execution_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    lock_id = Column(Integer, ForeignKey("locks.id"))
    instance_id = Column(String(255), nullable=False)
    status = Column(String(50), default=TaskStatus.PENDING)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    duration_seconds = Column(Float)
    result = Column(Text)
    error_message = Column(Text)
    error_stack = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    compensation_action = Column(String(255))
    compensation_note = Column(Text)

    task = relationship("Task", back_populates="execution_logs")
    lock = relationship("Lock", back_populates="execution_logs")


class AbnormalQueue(Base):
    __tablename__ = "abnormal_queues"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    execution_log_id = Column(Integer, ForeignKey("execution_logs.id"))
    lock_id = Column(Integer, ForeignKey("locks.id"))
    instance_id = Column(String(255), nullable=False)
    abnormal_type = Column(String(100), nullable=False)
    description = Column(Text)
    severity = Column(String(50), default="warning")
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True))
    is_resolved = Column(Boolean, default=False)
    resolution_note = Column(Text)

    task = relationship("Task")
