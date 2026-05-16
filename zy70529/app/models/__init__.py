from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class CompensationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    MANUAL_FIXED = "manual_fixed"


class CompensationStrategy(str, enum.Enum):
    RETRY_ONCE = "retry_once"
    RETRY_THREE = "retry_three"
    MANUAL = "manual"
    SKIP = "skip"


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, index=True)
    queue_name = Column(String(255), index=True, nullable=False)
    message_id = Column(String(255), index=True, nullable=False)
    business_no = Column(String(255), index=True, nullable=False)
    status = Column(String(50), index=True, nullable=False, default=CompensationStatus.PENDING)
    strategy = Column(String(50), nullable=False, default=CompensationStrategy.RETRY_THREE)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    original_input = Column(JSON, nullable=False)
    process_basis = Column(Text)
    final_conclusion = Column(Text)
    error_message = Column(Text)
    batch_id = Column(String(100), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True))

    histories = relationship("CompensationHistory", back_populates="record", cascade="all, delete-orphan")


class CompensationHistory(Base):
    __tablename__ = "compensation_histories"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("compensation_records.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    operation_type = Column(String(50), nullable=False)
    operator = Column(String(100), default="system")
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("CompensationRecord", back_populates="histories")


class CompensationBatch(Base):
    __tablename__ = "compensation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    queue_name = Column(String(255), index=True, nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    status = Column(String(50), default="processing")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))


class CompensationReport(Base):
    __tablename__ = "compensation_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(String(100), index=True)
    queue_name = Column(String(255), index=True)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    file_path = Column(String(500))
    created_by = Column(String(100), default="system")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
