from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class CodeStatus(str, enum.Enum):
    AVAILABLE = "available"
    ISSUED = "issued"
    BOUND = "bound"
    RECYCLED = "recycled"
    INVALID = "invalid"


class BindingStatus(str, enum.Enum):
    ACTIVE = "active"
    UNBOUND = "unbound"


class ExceptionType(str, enum.Enum):
    INVALID_CODE = "invalid_code"
    INVALID_BATCH = "invalid_batch"
    INVALID_REPORT = "invalid_report"
    DATA_CONFLICT = "data_conflict"
    SYSTEM_ERROR = "system_error"


class TaskType(str, enum.Enum):
    CODE_GENERATION = "code_generation"
    BATCH_PROCESSING = "batch_processing"
    REPORT_IMPORT = "report_import"
    DATA_SYNC = "data_sync"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRY = "retry"


class TraceabilityCode(Base):
    __tablename__ = "traceability_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default=CodeStatus.AVAILABLE, nullable=False)
    cooperative_id = Column(String, nullable=True)
    farmer_id = Column(String, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    recycled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bindings = relationship("CodeBatchBinding", back_populates="code", cascade="all, delete-orphan")
    scan_logs = relationship("ScanLog", back_populates="code", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True, nullable=False)
    cooperative_id = Column(String, nullable=False)
    farmer_id = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    harvest_date = Column(DateTime, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bindings = relationship("CodeBatchBinding", back_populates="batch", cascade="all, delete-orphan")
    reports = relationship("InspectionReport", back_populates="batch", cascade="all, delete-orphan")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_number = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    inspector = Column(String, nullable=False)
    inspection_date = Column(DateTime, nullable=False)
    result = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    batch = relationship("Batch", back_populates="reports")


class CodeBatchBinding(Base):
    __tablename__ = "code_batch_bindings"

    id = Column(Integer, primary_key=True, index=True)
    code_id = Column(Integer, ForeignKey("traceability_codes.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    status = Column(String, default=BindingStatus.ACTIVE, nullable=False)
    bound_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    unbound_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    code = relationship("TraceabilityCode", back_populates="bindings")
    batch = relationship("Batch", back_populates="bindings")


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, index=True)
    code_id = Column(Integer, ForeignKey("traceability_codes.id"), nullable=True)
    code_value = Column(String, nullable=False)
    scanner_ip = Column(String, nullable=True)
    scanner_user_agent = Column(String, nullable=True)
    scan_result = Column(String, nullable=False)
    scanned_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    code = relationship("TraceabilityCode", back_populates="scan_logs")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    exception_type = Column(String, nullable=False)
    operation = Column(String, nullable=False)
    data = Column(Text, nullable=True)
    error_message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PendingTask(Base):
    __tablename__ = "pending_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    data = Column(Text, nullable=True)
    assigned_to = Column(String, nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String, nullable=False)
    status = Column(String, default=TaskStatus.PENDING, nullable=False)
    data = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    error_message = Column(Text, nullable=True)
    last_executed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
