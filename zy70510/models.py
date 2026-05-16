import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    MERGED = "merged"
    MANUAL_FIXED = "manual_fixed"


class TriggerSource(str, enum.Enum):
    API = "api"
    SCHEDULER = "scheduler"
    MANUAL = "manual"
    WEBHOOK = "webhook"
    BATCH = "batch"


class TaskBatch(Base):
    __tablename__ = "task_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    batch_name = Column(String(255), nullable=False)
    trigger_source = Column(Enum(TriggerSource), nullable=False)
    idempotent_key = Column(String(255), unique=True, index=True, nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    original_input = Column(JSON, nullable=False)
    result_snapshot = Column(JSON)
    receipt_no = Column(String(64), unique=True, index=True)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime)
    operator = Column(String(64))
    remark = Column(Text)

    details = relationship("ProcessDetail", back_populates="batch", cascade="all, delete-orphan")
    merge_records = relationship("MergeRecord", foreign_keys="MergeRecord.target_batch_id",
                                 back_populates="target_batch", cascade="all, delete-orphan")


class ProcessDetail(Base):
    __tablename__ = "process_details"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("task_batches.id"), nullable=False)
    detail_no = Column(String(64), unique=True, index=True, nullable=False)
    item_key = Column(String(255), index=True, nullable=False)
    item_data = Column(JSON, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    result_data = Column(JSON)
    error_message = Column(Text)
    processing_basis = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime)
    retry_count = Column(Integer, default=0)

    batch = relationship("TaskBatch", back_populates="details")


class MergeRecord(Base):
    __tablename__ = "merge_records"

    id = Column(Integer, primary_key=True, index=True)
    source_batch_id = Column(Integer, ForeignKey("task_batches.id"), nullable=False)
    target_batch_id = Column(Integer, ForeignKey("task_batches.id"), nullable=False)
    merge_reason = Column(String(255), nullable=False)
    merged_at = Column(DateTime, default=datetime.utcnow)
    operator = Column(String(64))

    source_batch = relationship("TaskBatch", foreign_keys=[source_batch_id])
    target_batch = relationship("TaskBatch", foreign_keys=[target_batch_id])


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_no = Column(String(64), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("task_batches.id"), nullable=False)
    idempotent_key = Column(String(255), unique=True, index=True, nullable=False)
    status = Column(Enum(TaskStatus), nullable=False)
    final_conclusion = Column(Text)
    result_summary = Column(JSON)
    issued_at = Column(DateTime, default=datetime.utcnow)
    issued_by = Column(String(64))
    export_count = Column(Integer, default=0)
    last_exported_at = Column(DateTime)

    batch = relationship("TaskBatch")
