from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    MISSED = "missed"
    RECOVERING = "recovering"
    RECOVERED = "recovered"
    NEEDS_REVIEW = "needs_review"


class RecoveryAction(str, enum.Enum):
    AUTO_RECOVER = "auto_recover"
    MANUAL_RECOVER = "manual_recover"
    SKIP = "skip"
    RERUN = "rerun"


class BatchTask(Base):
    __tablename__ = "batch_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(200), index=True, nullable=False)
    planned_time = Column(DateTime, nullable=False, index=True)
    actual_start_time = Column(DateTime)
    actual_end_time = Column(DateTime)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    missed_reason = Column(Text)
    recovery_action = Column(Enum(RecoveryAction))
    recovery_time = Column(DateTime)
    recovered_by = Column(String(100))
    is_impact_calculated = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    impact_items = relationship("ImpactItem", back_populates="batch_task", cascade="all, delete-orphan")


class ImpactItem(Base):
    __tablename__ = "impact_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_task_id = Column(Integer, ForeignKey("batch_tasks.id"), nullable=False)
    impact_type = Column(String(100), nullable=False)
    impact_description = Column(Text, nullable=False)
    affected_data = Column(Text)
    affected_range = Column(String(200))
    severity = Column(String(50), default="medium")
    resolution_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    batch_task = relationship("BatchTask", back_populates="impact_items")


class RecoveryLock(Base):
    __tablename__ = "recovery_locks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(200), unique=True, index=True, nullable=False)
    locked_by = Column(String(100), nullable=False)
    locked_at = Column(DateTime, server_default=func.now())
    lock_expire_at = Column(DateTime, nullable=False)
