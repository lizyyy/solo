from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"
    CONFLICT = "conflict"


class DetailStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class VerificationRule(Base):
    __tablename__ = "verification_rules"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), unique=True, index=True, nullable=False)
    rule_name = Column(String(100), nullable=False)
    description = Column(Text)
    rule_config = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100))

    batches = relationship("Batch", back_populates="rule")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True, nullable=False)
    caller = Column(String(100), index=True, nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String(50), default=BatchStatus.PENDING)
    rule_version = Column(String(50), ForeignKey("verification_rules.version"))
    rule_snapshot = Column(Text)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    remark = Column(Text)
    content_hash = Column(String(64), index=True)

    rule = relationship("VerificationRule", back_populates="batches")
    details = relationship("BatchDetail", back_populates="batch", cascade="all, delete-orphan")
    manual_notes = relationship("ManualNote", back_populates="batch", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_batch_caller_submitted", "caller", "submitted_at"),
    )


class BatchDetail(Base):
    __tablename__ = "batch_details"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    sequence_no = Column(Integer, nullable=False)
    member_id = Column(String(100), index=True)
    transaction_no = Column(String(100), index=True)
    transaction_time = Column(DateTime(timezone=True))
    amount = Column(Float, default=0.0)
    transaction_type = Column(String(50))
    original_data = Column(Text)
    status = Column(String(50), default=DetailStatus.PENDING)
    verification_result = Column(Text)
    error_message = Column(Text)
    is_time_order_error = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True))

    batch = relationship("Batch", back_populates="details")

    __table_args__ = (
        Index("idx_detail_batch_sequence", "batch_id", "sequence_no"),
        Index("idx_detail_member_transaction", "member_id", "transaction_time"),
    )


class ManualNote(Base):
    __tablename__ = "manual_notes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    detail_id = Column(Integer, ForeignKey("batch_details.id"))
    caller = Column(String(100), index=True)
    note_content = Column(Text, nullable=False)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    note_type = Column(String(50))

    batch = relationship("Batch", back_populates="manual_notes")
    detail = relationship("BatchDetail")


class ExportTask(Base):
    __tablename__ = "export_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(100), unique=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    export_type = Column(String(50))
    status = Column(String(50), default="pending")
    file_path = Column(String(500))
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
