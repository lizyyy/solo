from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class GPUStatus:
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class TaskStatus:
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"
    RETRYING = "retrying"


class HistoryAction:
    SUBMITTED = "submitted"
    QUEUED = "queued"
    SCHEDULED = "scheduled"
    STARTED = "started"
    FAILED = "failed"
    SUCCEEDED = "succeeded"
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"
    RETRY_SCHEDULED = "retry_scheduled"
    REJECTED = "rejected"


class GPU(Base):
    __tablename__ = "gpus"
    
    id = Column(Integer, primary_key=True, index=True)
    gpu_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    model = Column(String(128))
    memory_gb = Column(Integer)
    status = Column(String(32), default=GPUStatus.AVAILABLE, index=True)
    current_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    current_task = relationship("Task", foreign_keys=[current_task_id], back_populates="gpu")
    tasks = relationship("Task", foreign_keys="Task.gpu_id", back_populates="assigned_gpu")


class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(256), nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    gpu_id = Column(Integer, ForeignKey("gpus.id"), nullable=True)
    
    priority = Column(Integer, default=5, index=True)
    estimated_duration_minutes = Column(Integer, default=60)
    timeout_minutes = Column(Integer, default=120)
    
    status = Column(String(32), default=TaskStatus.PENDING, index=True)
    queue_position = Column(Integer, nullable=True)
    
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    command = Column(Text, nullable=True)
    script_path = Column(String(512), nullable=True)
    output_path = Column(String(512), nullable=True)
    
    submitted_at = Column(DateTime, default=datetime.utcnow, index=True)
    queued_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    assigned_gpu = relationship("GPU", foreign_keys=[gpu_id], back_populates="tasks")
    gpu = relationship("GPU", foreign_keys="GPU.current_task_id", back_populates="current_task", uselist=False)
    histories = relationship("TaskHistory", back_populates="task", order_by="TaskHistory.id.desc()")
    bill = relationship("Bill", back_populates="task", uselist=False)


class TaskHistory(Base):
    __tablename__ = "task_histories"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    
    action = Column(String(64), nullable=False, index=True)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=True)
    
    reason = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    gpu_id = Column(String(64), nullable=True)
    queue_position = Column(Integer, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    task = relationship("Task", back_populates="histories")


class Bill(Base):
    __tablename__ = "bills"
    
    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(String(64), unique=True, index=True, nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, unique=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    
    gpu_name = Column(String(128))
    gpu_memory_gb = Column(Integer)
    
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    total_seconds = Column(Integer, default=0)
    
    base_cost = Column(Float, default=0.0)
    premium_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    task = relationship("Task", back_populates="bill")


class SchedulerLog(Base):
    __tablename__ = "scheduler_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    event_type = Column(String(64), nullable=False, index=True)
    task_id = Column(String(64), nullable=True, index=True)
    gpu_id = Column(String(64), nullable=True, index=True)
    
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    
    success = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
