import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class RequestStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"
    MERGED = "merged"


class LanguageEnvironment(Base):
    __tablename__ = "language_environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    version = Column(String(50))
    container_image = Column(String(200))
    timeout_seconds = Column(Integer, default=30)
    memory_limit_mb = Column(Integer, default=512)
    cpu_limit = Column(Float, default=1.0)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requests = relationship("RunRequest", back_populates="language")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(200))
    quota_per_window = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requests = relationship("RunRequest", back_populates="student")
    quota_windows = relationship("QuotaWindow", back_populates="student")
    timeout_records = relationship("TimeoutRecord", back_populates="student")


class QuotaWindow(Base):
    __tablename__ = "quota_windows"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    window_start = Column(DateTime(timezone=True), nullable=False)
    window_end = Column(DateTime(timezone=True), nullable=False)
    used_quota = Column(Integer, default=0)
    max_quota = Column(Integer, default=10)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student", back_populates="quota_windows")


class RunRequest(Base):
    __tablename__ = "run_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    language_id = Column(Integer, ForeignKey("language_environments.id"), nullable=False)
    code_snippet = Column(Text, nullable=False)
    input_data = Column(Text)
    status = Column(String(20), default=RequestStatus.PENDING, index=True)
    priority = Column(Integer, default=0)
    merged_from = Column(String(100))
    container_id = Column(String(100))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    execution_time_ms = Column(Integer)
    memory_usage_kb = Column(Integer)
    stdout = Column(Text)
    stderr = Column(Text)
    exit_code = Column(Integer)
    error_message = Column(Text)
    created_by_manual = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    student = relationship("Student", back_populates="requests")
    language = relationship("LanguageEnvironment", back_populates="requests")
    status_history = relationship("StatusHistory", back_populates="request", order_by="StatusHistory.timestamp")
    timeout_record = relationship("TimeoutRecord", back_populates="request", uselist=False)


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("run_requests.id"), nullable=False)
    from_status = Column(String(20))
    to_status = Column(String(20), nullable=False)
    message = Column(String(500))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("RunRequest", back_populates="status_history")


class TimeoutRecord(Base):
    __tablename__ = "timeout_records"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("run_requests.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    timeout_at = Column(DateTime(timezone=True), server_default=func.now())
    timeout_after_seconds = Column(Integer, nullable=False)
    was_forced = Column(Boolean, default=True)
    reason = Column(String(500))

    request = relationship("RunRequest", back_populates="timeout_record")
    student = relationship("Student", back_populates="timeout_records")


class ResultSummary(Base):
    __tablename__ = "result_summaries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime(timezone=True), unique=True, index=True)
    total_requests = Column(Integer, default=0)
    successful = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    timed_out = Column(Integer, default=0)
    merged = Column(Integer, default=0)
    avg_execution_time_ms = Column(Float, default=0.0)
    total_execution_time_ms = Column(Integer, default=0)
    peak_concurrent_containers = Column(Integer, default=0)
    quota_exceeded_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
