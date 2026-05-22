from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    DATA_ENTRY = "data_entry"
    REVIEWER = "reviewer"
    SUPERVISOR = "supervisor"
    READ_ONLY = "read_only"


class RecordStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REJECTED = "rejected"
    CONFIRMED = "confirmed"
    AUDIT_ONLY = "audit_only"


class DirtyType(str, enum.Enum):
    MISSING_FIELD = "missing_field"
    CROSS_DATE = "cross_date"
    NAME_CHANGED = "name_changed"
    AMOUNT_CONFLICT = "amount_conflict"
    QUANTITY_CONFLICT = "quantity_conflict"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    franchise_id = Column(String(50), index=True)

    audit_logs = relationship("AuditLog", back_populates="user")
    created_records = relationship("LedgerRecord", foreign_keys="LedgerRecord.created_by", back_populates="creator")
    reviewed_records = relationship("LedgerRecord", foreign_keys="LedgerRecord.reviewed_by", back_populates="reviewer")


class LedgerRecord(Base):
    __tablename__ = "ledger_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    franchise_id = Column(String(50), index=True, nullable=False)
    franchise_name = Column(String(100))
    record_date = Column(DateTime, nullable=False)
    status = Column(Enum(RecordStatus), default=RecordStatus.DRAFT, nullable=False)

    material_name = Column(String(100))
    material_code = Column(String(50))
    quantity = Column(Float)
    unit = Column(String(20))
    unit_price = Column(Float)
    total_amount = Column(Float)

    order_quantity = Column(Float)
    order_amount = Column(Float)
    loss_quantity = Column(Float)
    loss_amount = Column(Float)
    headquarter_price = Column(Float)

    source_order_no = Column(String(50))
    source_loss_no = Column(String(50))

    change_reason = Column(Text)
    rejection_reason = Column(Text)
    remarks = Column(Text)

    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    confirmed_by = Column(Integer, ForeignKey("users.id"))
    confirmed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    is_dirty = Column(Boolean, default=False)
    dirty_types = Column(JSON)
    raw_data = Column(JSON)
    processing_notes = Column(Text)

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_records")
    reviewer = relationship("User", foreign_keys=[reviewed_by], back_populates="reviewed_records")
    status_history = relationship("StatusHistory", back_populates="ledger_record", order_by="StatusHistory.changed_at")
    dirty_records = relationship("DirtyRecord", back_populates="ledger_record")
    field_changes = relationship("FieldChangeLog", back_populates="ledger_record", order_by="FieldChangeLog.changed_at")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    ledger_record_id = Column(Integer, ForeignKey("ledger_records.id"))
    from_status = Column(Enum(RecordStatus))
    to_status = Column(Enum(RecordStatus), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text)

    ledger_record = relationship("LedgerRecord", back_populates="status_history")


class DirtyRecord(Base):
    __tablename__ = "dirty_records"

    id = Column(Integer, primary_key=True, index=True)
    ledger_record_id = Column(Integer, ForeignKey("ledger_records.id"))
    dirty_type = Column(Enum(DirtyType), nullable=False)
    field_name = Column(String(100))
    original_value = Column(Text)
    current_value = Column(Text)
    expected_value = Column(Text)
    description = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(Integer, ForeignKey("users.id"))
    resolved_at = Column(DateTime(timezone=True))
    resolution_notes = Column(Text)

    ledger_record = relationship("LedgerRecord", back_populates="dirty_records")


class FieldChangeLog(Base):
    __tablename__ = "field_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    ledger_record_id = Column(Integer, ForeignKey("ledger_records.id"))
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(Text)

    ledger_record = relationship("LedgerRecord", back_populates="field_changes")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50))
    resource_id = Column(String(50))
    ip_address = Column(String(50))
    user_agent = Column(String(200))
    details = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")


class SensitiveFieldConfig(Base):
    __tablename__ = "sensitive_field_configs"

    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100), unique=True, nullable=False)
    data_entry_visible = Column(Boolean, default=True)
    data_entry_editable = Column(Boolean, default=True)
    reviewer_visible = Column(Boolean, default=True)
    reviewer_editable = Column(Boolean, default=False)
    supervisor_visible = Column(Boolean, default=True)
    supervisor_editable = Column(Boolean, default=True)
    read_only_visible = Column(Boolean, default=False)
    mask_pattern = Column(String(100))
    is_export_masked = Column(Boolean, default=True)
