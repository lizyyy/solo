from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from enum import Enum

class BatchStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    PARTIAL_FAILED = "partial_failed"
    FROZEN = "frozen"
    ARCHIVED = "archived"
    WITHDRAWN = "withdrawn"

class ReceiptStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISPUTED = "disputed"
    RESOLVED = "resolved"
    OVERRULED = "overruled"
    CANCELLED = "cancelled"

class SourceType(str, Enum):
    ORDER_CALENDAR = "order_calendar"
    CLEANING_GROUP = "cleaning_group"
    MAINTENANCE_NOTE = "maintenance_note"
    HANDOVER_PAPER = "handover_paper"
    SMS_SCREENSHOT = "sms_screenshot"

class OperationType(str, Enum):
    BATCH_CREATE = "batch_create"
    BATCH_SUBMIT = "batch_submit"
    BATCH_WITHDRAW = "batch_withdraw"
    BATCH_FREEZE = "batch_freeze"
    BATCH_ARCHIVE = "batch_archive"
    RECEIPT_IMPORT = "receipt_import"
    RECEIPT_UPDATE = "receipt_update"
    RECEIPT_REVIEW = "receipt_review"
    RECEIPT_OVERRULE = "receipt_overrule"
    ATTACHMENT_UPLOAD = "attachment_upload"
    EXPORT_GENERATE = "export_generate"

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default=BatchStatus.DRAFT)
    source_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    store_code = Column(String, index=True)
    remark = Column(Text)
    
    is_frozen = Column(Boolean, default=False)
    frozen_at = Column(DateTime)
    frozen_by = Column(String)
    frozen_reason = Column(Text)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    receipts = relationship("Receipt", back_populates="batch", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="batch")
    operation_logs = relationship("OperationLog", back_populates="batch")
    diff_records = relationship("DiffRecord", back_populates="batch")

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    receipt_no = Column(String, unique=True, index=True, nullable=False)
    
    room_no = Column(String, index=True)
    guest_name = Column(String)
    check_in_date = Column(DateTime)
    check_out_date = Column(DateTime)
    scheduled_clean_date = Column(DateTime)
    actual_clean_date = Column(DateTime)
    
    exception_type = Column(String)
    exception_desc = Column(Text)
    status = Column(String, default=ReceiptStatus.PENDING)
    
    source_file = Column(String)
    source_row_no = Column(Integer)
    source_raw_data = Column(JSON)
    parsed_data = Column(JSON)
    
    review_result = Column(String)
    review_reason = Column(Text)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)
    
    is_manual_overruled = Column(Boolean, default=False)
    overrule_reason = Column(Text)
    overruled_by = Column(String)
    overruled_at = Column(DateTime)
    
    before_freeze_status = Column(String)
    after_freeze_status = Column(String)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    batch = relationship("Batch", back_populates="receipts")
    attachments = relationship("Attachment", back_populates="receipt")
    operation_logs = relationship("OperationLog", back_populates="receipt")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    receipt_id = Column(Integer, ForeignKey("receipts.id"))
    
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    file_type = Column(String)
    source_type = Column(String)
    uploaded_by = Column(String, nullable=False)
    remark = Column(Text)
    
    created_at = Column(DateTime, server_default=func.now())
    
    batch = relationship("Batch", back_populates="attachments")
    receipt = relationship("Receipt", back_populates="attachments")

class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    receipt_id = Column(Integer, ForeignKey("receipts.id"))
    
    operation_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    operation_time = Column(DateTime, server_default=func.now())
    
    before_state = Column(JSON)
    after_state = Column(JSON)
    diff_summary = Column(JSON)
    
    remark = Column(Text)
    ip_address = Column(String)
    user_agent = Column(String)
    
    batch = relationship("Batch", back_populates="operation_logs")
    receipt = relationship("Receipt", back_populates="operation_logs")

class DiffRecord(Base):
    __tablename__ = "diff_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    receipt_id = Column(Integer)
    
    operation_type = Column(String, nullable=False)
    field_name = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    
    changed_by = Column(String)
    changed_at = Column(DateTime, server_default=func.now())
    change_reason = Column(Text)
    
    batch = relationship("Batch", back_populates="diff_records")
