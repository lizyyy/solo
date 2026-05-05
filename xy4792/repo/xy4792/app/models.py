from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    DEAD_LETTER = "dead_letter"


class StepType(str, PyEnum):
    OCR = "ocr"
    VALIDATION = "validation"
    REPORT = "report"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    contract_name = Column(String, index=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    celery_task_id = Column(String, index=True, nullable=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    step_logs = relationship("StepLog", back_populates="task", cascade="all, delete-orphan")
    retries = relationship("RetryLog", back_populates="task", cascade="all, delete-orphan")
    dead_letter = relationship("DeadLetter", back_populates="task", uselist=False)


class StepLog(Base):
    __tablename__ = "step_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, ForeignKey("tasks.id"))
    step_type = Column(Enum(StepType))
    status = Column(String)
    message = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="step_logs")


class RetryLog(Base):
    __tablename__ = "retry_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, ForeignKey("tasks.id"))
    retry_number = Column(Integer)
    failed_step = Column(Enum(StepType))
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="retries")


class DeadLetter(Base):
    __tablename__ = "dead_letters"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    task_id = Column(String, ForeignKey("tasks.id"), unique=True)
    reason = Column(Text)
    last_error = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    replayed = Column(Integer, default=0)

    task = relationship("Task", back_populates="dead_letter")
