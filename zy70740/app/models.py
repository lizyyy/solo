from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Enum
from datetime import datetime
import enum
from .database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GPUModel(str, enum.Enum):
    A100 = "A100"
    A10 = "A10"
    V100 = "V100"
    T4 = "T4"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, unique=True, index=True)
    gpu_model = Column(String)
    gpu_count = Column(Integer)
    estimated_duration = Column(Float)
    priority = Column(Integer)
    user = Column(String)
    status = Column(String, default=JobStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    timeout_at = Column(DateTime)
    queue_position = Column(Integer)


class ReleaseEvent(Base):
    __tablename__ = "release_events"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String)
    released_gpus = Column(Integer)
    gpu_model = Column(String)
    released_at = Column(DateTime, default=datetime.utcnow)
    released_by = Column(String)


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    original_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class GPUResource(Base):
    __tablename__ = "gpu_resources"

    id = Column(Integer, primary_key=True, index=True)
    gpu_model = Column(String, unique=True)
    total = Column(Integer)
    available = Column(Integer)
    last_updated = Column(DateTime, default=datetime.utcnow)