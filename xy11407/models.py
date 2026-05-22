from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, JSON, ForeignKey, Float, Boolean
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class QueueStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RETRYING = "retrying"
    MANUAL = "manual"
    COMPENSATED = "compensated"
    CLOSED = "closed"
    DEAD_LETTER = "dead_letter"


class DirtyType(str, Enum):
    MISSING_FIELD = "missing_field"
    CROSS_DAY = "cross_day"
    NAME_CHANGED = "name_changed"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"
    BATCH_MISMATCH = "batch_mismatch"


class RetryCategory(str, Enum):
    NETWORK_ERROR = "network_error"
    EXTERNAL_TIMEOUT = "external_timeout"
    INVALID_RECEIPT = "invalid_receipt"
    PARTIAL_SUCCESS = "partial_success"


class MedicineRecord(Base):
    __tablename__ = "medicine_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_no = Column(String(64), unique=True, index=True, nullable=False)
    store_id = Column(String(32), index=True, nullable=False)
    store_name = Column(String(128), nullable=False)
    medicine_id = Column(String(64), index=True, nullable=False)
    medicine_name = Column(String(256), nullable=False)
    batch_no = Column(String(64), index=True, nullable=False)
    expiry_date = Column(String(32), nullable=False)
    quantity = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    
    source_type = Column(String(32), nullable=False)
    source_ref = Column(String(256))
    source_meta = Column(JSON, default=dict)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    queue_items = relationship("QueueItem", back_populates="medicine_record")
    snapshots = relationship("RecordSnapshot", back_populates="medicine_record")
    attachments = relationship("Attachment", back_populates="medicine_record")


class QueueItem(Base):
    __tablename__ = "queue_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    queue_no = Column(String(64), unique=True, index=True, nullable=False)
    record_id = Column(Integer, ForeignKey("medicine_records.id"), nullable=False)
    store_id = Column(String(32), index=True, nullable=False)
    region_id = Column(String(32), index=True)
    
    status = Column(String(32), default=QueueStatus.PENDING, index=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=5)
    retry_category = Column(String(64), index=True)
    
    external_receipt_no = Column(String(128))
    external_status = Column(String(64))
    external_response = Column(JSON, default=dict)
    
    current_quantity = Column(Float)
    current_amount = Column(Float)
    
    handler = Column(String(64))
    handled_at = Column(DateTime)
    handle_notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_processed_at = Column(DateTime)
    
    medicine_record = relationship("MedicineRecord", back_populates="queue_items")
    retry_logs = relationship("RetryLog", back_populates="queue_item")
    status_history = relationship("StatusHistory", back_populates="queue_item")


class RetryLog(Base):
    __tablename__ = "retry_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    queue_item_id = Column(Integer, ForeignKey("queue_items.id"), nullable=False)
    attempt_no = Column(Integer, nullable=False)
    retry_category = Column(String(64))
    
    before_data = Column(JSON, default=dict)
    after_data = Column(JSON, default=dict)
    diff_summary = Column(JSON, default=dict)
    
    error_message = Column(Text)
    response_data = Column(JSON, default=dict)
    success = Column(Boolean, default=False)
    
    attempted_at = Column(DateTime, default=datetime.utcnow)
    next_retry_at = Column(DateTime)
    
    queue_item = relationship("QueueItem", back_populates="retry_logs")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    queue_item_id = Column(Integer, ForeignKey("queue_items.id"), nullable=False)
    from_status = Column(String(32))
    to_status = Column(String(32), nullable=False)
    
    before_snapshot = Column(JSON, default=dict)
    after_snapshot = Column(JSON, default=dict)
    diff_fields = Column(JSON, default=list)
    
    operator = Column(String(64))
    reason = Column(Text)
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    queue_item = relationship("QueueItem", back_populates="status_history")


class DirtyRecord(Base):
    __tablename__ = "dirty_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("medicine_records.id"))
    source_ref = Column(String(256))
    
    dirty_type = Column(String(64), index=True, nullable=False)
    dirty_fields = Column(JSON, default=list)
    conflict_details = Column(JSON, default=dict)
    
    original_content = Column(JSON, default=dict)
    processing_opinion = Column(Text)
    corrected_content = Column(JSON, default=dict)
    
    status = Column(String(32), default="pending")
    resolver = Column(String(64))
    resolved_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class RecordSnapshot(Base):
    __tablename__ = "record_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("medicine_records.id"), nullable=False)
    snapshot_type = Column(String(32))
    snapshot_data = Column(JSON, default=dict)
    
    created_by = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    medicine_record = relationship("MedicineRecord", back_populates="snapshots")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("medicine_records.id"), nullable=False)
    attachment_type = Column(String(64), nullable=False)
    file_name = Column(String(256), nullable=False)
    file_path = Column(String(512))
    file_hash = Column(String(128))
    meta_data = Column(JSON, default=dict)
    
    uploaded_by = Column(String(64))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    medicine_record = relationship("MedicineRecord", back_populates="attachments")


class CompensationRecord(Base):
    __tablename__ = "compensation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    queue_item_id = Column(Integer, ForeignKey("queue_items.id"), nullable=False)
    compensation_no = Column(String(64), unique=True, index=True)
    
    before_compensation = Column(JSON, default=dict)
    after_compensation = Column(JSON, default=dict)
    compensation_rules = Column(JSON, default=dict)
    diff_summary = Column(JSON, default=dict)
    
    compensated_quantity = Column(Float)
    compensated_amount = Column(Float)
    
    operator = Column(String(64))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class MedicineRecordCreate(BaseModel):
    store_id: str
    store_name: str
    medicine_id: str
    medicine_name: str
    batch_no: str
    expiry_date: str
    quantity: float
    amount: float
    source_type: str
    source_ref: Optional[str] = None
    source_meta: Dict[str, Any] = Field(default_factory=dict)


class QueueItemResponse(BaseModel):
    id: int
    queue_no: str
    record_id: int
    store_id: str
    status: QueueStatus
    retry_count: int
    max_retries: int
    retry_category: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DiffDetail(BaseModel):
    field: str
    before: Any
    after: Any
    change_type: str


class StatusHistoryResponse(BaseModel):
    id: int
    from_status: Optional[str]
    to_status: str
    diff_fields: List[str]
    operator: Optional[str]
    reason: Optional[str]
    changed_at: datetime


class RetryLogResponse(BaseModel):
    id: int
    attempt_no: int
    retry_category: Optional[str]
    diff_summary: Dict[str, Any]
    error_message: Optional[str]
    success: bool
    attempted_at: datetime


class SupervisorStats(BaseModel):
    retry_by_category: Dict[str, int] = Field(default_factory=dict)
    dead_letter_by_type: Dict[str, int] = Field(default_factory=dict)
    recovery_rate: float = 0.0
    pending_manual: int = 0
    closed_today: int = 0
