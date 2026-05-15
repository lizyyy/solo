from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class RiskType(str, enum.Enum):
    EXPIRED_VERSION = "expired_version"
    MERGE_ERROR = "merge_error"
    DATA_INCONSISTENCY = "data_inconsistency"
    PERMISSION_VIOLATION = "permission_violation"
    UNKNOWN = "unknown"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    CONFLICT = "conflict"
    REUSED = "reused"
    ROLLBACK = "rollback"


class TokenStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    USED = "used"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    operator = Column(String, index=True, nullable=False)
    description = Column(Text)
    risk_type = Column(String, index=True, nullable=False)
    status = Column(String, default=ProcessingStatus.PENDING)
    content_hash = Column(String, index=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tokens = relationship("Token", back_populates="batch")
    processing_records = relationship("ProcessingRecord", back_populates="batch")
    failed_items = relationship("FailedItem", back_populates="batch")
    approval_items = relationship("ApprovalItem", back_populates="batch")
    candidate_lists = relationship("CandidateList", back_populates="batch")


class Token(Base):
    __tablename__ = "tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_value = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    subject = Column(String, index=True, nullable=False)
    risk_type = Column(String, index=True)
    status = Column(String, default=TokenStatus.ACTIVE)
    expires_at = Column(DateTime, nullable=False)
    issued_at = Column(DateTime, default=datetime.utcnow)
    issued_by = Column(String)
    token_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="tokens")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_type = Column(String, index=True)
    content_before = Column(JSON)
    content_after = Column(JSON)
    status = Column(String)
    operator = Column(String)
    execution_time_ms = Column(Integer)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="processing_records")


class FailedItem(Base):
    __tablename__ = "failed_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    item_key = Column(String, index=True)
    content = Column(JSON)
    error_type = Column(String)
    error_message = Column(Text)
    stack_trace = Column(Text)
    retry_count = Column(Integer, default=0)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="failed_items")


class ApprovalItem(Base):
    __tablename__ = "approval_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    item_key = Column(String, index=True)
    title = Column(String)
    content = Column(JSON)
    assignee = Column(String, index=True)
    status = Column(String, default="pending")
    priority = Column(String, default="normal")
    due_date = Column(DateTime)
    reminders_count = Column(Integer, default=0)
    last_reminder_at = Column(DateTime)
    approved_by = Column(String)
    approved_at = Column(DateTime)
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="approval_items")


class CandidateList(Base):
    __tablename__ = "candidate_lists"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    list_type = Column(String, index=True)
    name = Column(String)
    description = Column(Text)
    items = Column(JSON)
    approved = Column(Boolean, default=False)
    approved_by = Column(String)
    approved_at = Column(DateTime)
    executed = Column(Boolean, default=False)
    executed_at = Column(DateTime)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="candidate_lists")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    report_type = Column(String)
    title = Column(String)
    summary = Column(Text)
    comparison_data = Column(JSON)
    execution_stats = Column(JSON)
    next_steps = Column(JSON)
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch")
