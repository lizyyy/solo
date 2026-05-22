from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, DateTime, Text, Float,
    ForeignKey, Enum, Boolean, JSON
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class ReceiptStatus(str, PyEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    FROZEN = "frozen"
    ARCHIVED = "archived"


class TaskStatus(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    WAITING_RETRY = "waiting_retry"
    WAITING_MANUAL = "waiting_manual"
    PERMANENT_FAILED = "permanent_failed"
    COMPLETED = "completed"


class DuplicateAction(str, PyEnum):
    IGNORE = "ignore"
    OVERWRITE = "overwrite"
    APPEND = "append"


class AttachmentType(str, PyEnum):
    INVENTORY_EXPORT = "inventory_export"
    TRANSFER_ORDER = "transfer_order"
    RETURN_PHOTO = "return_photo"
    PRICE_ADJUSTMENT = "price_adjustment"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(String(64), primary_key=True)
    pharmacy_id = Column(String(64), nullable=False, index=True)
    pharmacy_name = Column(String(255), nullable=False)
    region = Column(String(100), nullable=False, index=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=func.now(), index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    description = Column(Text, nullable=True)
    total_receipts = Column(Integer, default=0)
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.DRAFT)
    frozen_at = Column(DateTime, nullable=True)
    frozen_by = Column(String(100), nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)

    receipts = relationship("Receipt", back_populates="batch", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="batch", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="batch", cascade="all, delete-orphan")
    tasks = relationship("AsyncTask", back_populates="batch", cascade="all, delete-orphan")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batches.id"), nullable=False)
    idempotency_key = Column(String(128), nullable=False, unique=True, index=True)
    medicine_code = Column(String(64), nullable=False, index=True)
    medicine_name = Column(String(255), nullable=False)
    specification = Column(String(100), nullable=True)
    batch_number = Column(String(100), nullable=False)
    expiry_date = Column(DateTime, nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20), nullable=False)
    original_price = Column(Float, nullable=False)
    adjusted_price = Column(Float, nullable=True)
    source_type = Column(String(50), nullable=False)
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.DRAFT)
    review_reason = Column(Text, nullable=True)
    review_by = Column(String(100), nullable=True)
    review_at = Column(DateTime, nullable=True)
    freeze_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    version = Column(Integer, default=1)
    previous_status = Column(Enum(ReceiptStatus), nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)

    batch = relationship("Batch", back_populates="receipts")
    audit_logs = relationship("AuditLog", back_populates="receipt")
    status_transitions = relationship("StatusTransition", back_populates="receipt", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batches.id"), nullable=False)
    receipt_id = Column(String(64), ForeignKey("receipts.id"), nullable=True)
    attachment_type = Column(Enum(AttachmentType), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, default=func.now())
    description = Column(Text, nullable=True)

    batch = relationship("Batch", back_populates="attachments")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(64), ForeignKey("batches.id"), nullable=True)
    receipt_id = Column(String(64), ForeignKey("receipts.id"), nullable=True)
    action = Column(String(100), nullable=False)
    actor = Column(String(100), nullable=False)
    action_at = Column(DateTime, default=func.now(), index=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)

    batch = relationship("Batch", back_populates="audit_logs")
    receipt = relationship("Receipt", back_populates="audit_logs")


class StatusTransition(Base):
    __tablename__ = "status_transitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(String(64), ForeignKey("receipts.id"), nullable=False)
    from_status = Column(Enum(ReceiptStatus), nullable=False)
    to_status = Column(Enum(ReceiptStatus), nullable=False)
    transitioned_by = Column(String(100), nullable=False)
    transitioned_at = Column(DateTime, default=func.now())
    reason = Column(Text, nullable=True)

    receipt = relationship("Receipt", back_populates="status_transitions")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(String(64), primary_key=True)
    batch_id = Column(String(64), ForeignKey("batches.id"), nullable=True)
    task_type = Column(String(100), nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    error_stacktrace = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    next_retry_at = Column(DateTime, nullable=True)
    result_data = Column(JSON, nullable=True)
    payload = Column(JSON, nullable=True)

    batch = relationship("Batch", back_populates="tasks")
