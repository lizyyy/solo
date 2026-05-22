from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Float, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class SourceType(str, enum.Enum):
    INVENTORY_EXPORT = "inventory_export"
    MANUAL_TRANSFER = "manual_transfer"
    RETURN_PHOTO = "return_photo"
    EXTERNAL_RECEIPT = "external_receipt"


class RecordStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_FIX = "needs_fix"
    RECONCILED = "reconciled"
    FAILED = "failed"
    MANUALLY_RESOLVED = "manually_resolved"


class AcceptanceRecord(Base):
    __tablename__ = "acceptance_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    pharmacy_name = Column(String(100), nullable=False)
    pharmacy_region = Column(String(50))
    source_type = Column(Enum(SourceType), nullable=False)
    source_ref = Column(String(100))

    medicine_name = Column(String(200), nullable=False)
    medicine_code = Column(String(50))
    batch_no = Column(String(100), nullable=False)
    expiry_date = Column(String(20))
    quantity = Column(Integer, nullable=False)
    unit = Column(String(20))

    near_expiry_days = Column(Integer)

    status = Column(Enum(RecordStatus), default=RecordStatus.DRAFT, nullable=False)
    is_valid = Column(Boolean, default=True)
    is_bad_data = Column(Boolean, default=False)

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    external_data = Column(Text)
    notes = Column(Text)

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_records")
    status_logs = relationship("StatusLog", back_populates="record", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="record", cascade="all, delete-orphan")
    reconciliation = relationship("ReconciliationResult", back_populates="record", uselist=False)


class StatusLog(Base):
    __tablename__ = "status_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    from_status = Column(Enum(RecordStatus))
    to_status = Column(Enum(RecordStatus), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operated_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text, nullable=False)

    record = relationship("AcceptanceRecord", back_populates="status_logs")
    operator = relationship("User", back_populates="status_logs")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))
    file_size = Column(Integer)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(String(200))

    record = relationship("AcceptanceRecord", back_populates="attachments")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("acceptance_records.id"), unique=True, nullable=False)
    is_matched = Column(Boolean, default=False)
    match_score = Column(Float)
    matched_with = Column(String(100))
    reconciliation_notes = Column(Text)
    reconciled_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("AcceptanceRecord", back_populates="reconciliation")


class FailedRecord(Base):
    __tablename__ = "failed_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    record_no = Column(String(50))
    error_type = Column(String(100))
    error_message = Column(Text)
    error_details = Column(Text)
    failed_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    raw_data = Column(Text)
