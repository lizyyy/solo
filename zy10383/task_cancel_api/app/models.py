import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    FAILED = "failed"


class PropagationStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    PROPAGATING = "propagating"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"


class CleanupStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class MainTask(Base):
    __tablename__ = "main_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sub_tasks = relationship("SubTask", back_populates="main_task", cascade="all, delete-orphan")
    cancel_reason = relationship("CancelReason", back_populates="main_task", uselist=False)
    propagation = relationship("PropagationState", back_populates="main_task", uselist=False)


class SubTask(Base):
    __tablename__ = "sub_tasks"

    id = Column(Integer, primary_key=True, index=True)
    sub_task_id = Column(String, unique=True, index=True, nullable=False)
    main_task_id = Column(Integer, ForeignKey("main_tasks.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    main_task = relationship("MainTask", back_populates="sub_tasks")
    temp_resources = relationship("TempResource", back_populates="sub_task", cascade="all, delete-orphan")
    cleanup_results = relationship("CleanupResult", back_populates="sub_task", cascade="all, delete-orphan")


class CancelReason(Base):
    __tablename__ = "cancel_reasons"

    id = Column(Integer, primary_key=True, index=True)
    main_task_id = Column(Integer, ForeignKey("main_tasks.id"), nullable=False, unique=True)
    reason_code = Column(String, nullable=False)
    reason_message = Column(Text, nullable=False)
    triggered_by = Column(String)
    suppress_notification = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    main_task = relationship("MainTask", back_populates="cancel_reason")


class TempResource(Base):
    __tablename__ = "temp_resources"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(String, unique=True, index=True, nullable=False)
    sub_task_id = Column(Integer, ForeignKey("sub_tasks.id"), nullable=False)
    resource_type = Column(String, nullable=False)
    resource_location = Column(String)
    size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    sub_task = relationship("SubTask", back_populates="temp_resources")


class PropagationState(Base):
    __tablename__ = "propagation_states"

    id = Column(Integer, primary_key=True, index=True)
    main_task_id = Column(Integer, ForeignKey("main_tasks.id"), nullable=False, unique=True)
    status = Column(Enum(PropagationStatus), default=PropagationStatus.NOT_STARTED)
    current_sub_task_index = Column(Integer, default=0)
    total_sub_tasks = Column(Integer, default=0)
    completed_sub_tasks = Column(Integer, default=0)
    failed_sub_tasks = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    main_task = relationship("MainTask", back_populates="propagation")


class CleanupResult(Base):
    __tablename__ = "cleanup_results"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(String, unique=True, index=True, nullable=False)
    sub_task_id = Column(Integer, ForeignKey("sub_tasks.id"), nullable=False)
    resource_id = Column(String)
    status = Column(Enum(CleanupStatus), default=CleanupStatus.PENDING)
    detail = Column(Text)
    cleaned_count = Column(Integer, default=0)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    sub_task = relationship("SubTask", back_populates="cleanup_results")


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_key = Column(String, unique=True, index=True, nullable=False)
    endpoint = Column(String, nullable=False)
    response_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
