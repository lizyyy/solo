from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class ProcessingStatus:
    IMPORTED = "imported"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    HOLIDAY_ADJUSTED = "holiday_adjusted"
    BALANCE_UPDATED = "balance_updated"
    NEEDS_MANAGER_REVIEW = "needs_manager_review"
    REJECTED = "rejected"


class SourceType:
    CLEARING_BATCH = "clearing_batch"
    MANUAL_ENTRY = "manual_entry"
    HOLIDAY_ADJUSTMENT = "holiday_adjustment"


class ClearingBatch(Base):
    __tablename__ = "clearing_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, nullable=False)
    import_date = Column(DateTime, default=datetime.now)
    imported_by = Column(String, default="system")
    status = Column(String, default=ProcessingStatus.IMPORTED)
    total_amount = Column(Float, default=0.0)
    record_count = Column(Integer, default=0)
    holiday_reviewed = Column(Boolean, default=False)
    holiday_reviewed_by = Column(String, nullable=True)
    holiday_reviewed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    records = relationship("CommissionRecord", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")


class CommissionRecord(Base):
    __tablename__ = "commission_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"))
    original_line_number = Column(Integer, nullable=False)
    fund_code = Column(String, index=True)
    fund_name = Column(String)
    customer_account = Column(String)
    customer_name = Column(String)
    manager_name = Column(String)
    manager_code = Column(String)
    approval_name = Column(String)
    approval_name_is_pinyin = Column(Boolean, default=False)
    transaction_date = Column(DateTime)
    settlement_date = Column(DateTime)
    original_settlement_date = Column(DateTime)
    transaction_amount = Column(Float)
    commission_rate = Column(Float)
    commission_amount = Column(Float)
    trail_commission_amount = Column(Float)
    split_ratio = Column(Float, default=1.0)
    final_amount = Column(Float)
    source_type = Column(String, default=SourceType.CLEARING_BATCH)
    status = Column(String, default=ProcessingStatus.IMPORTED)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of_id = Column(Integer, nullable=True)
    manually_modified = Column(Boolean, default=False)
    modification_notes = Column(Text, nullable=True)
    balance_updated = Column(Boolean, default=False)
    needs_manager_review = Column(Boolean, default=False)
    manager_reviewed = Column(Boolean, default=False)
    manager_reviewed_by = Column(String, nullable=True)
    manager_reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ClearingBatch", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")
    balance_changes = relationship("BalanceChange", back_populates="commission_record")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"), nullable=True)
    record_id = Column(Integer, ForeignKey("commission_records.id"), nullable=True)
    action = Column(String, nullable=False)
    field_name = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    performed_by = Column(String, nullable=False)
    performed_at = Column(DateTime, default=datetime.now)
    notes = Column(Text, nullable=True)

    batch = relationship("ClearingBatch", back_populates="audit_logs")
    record = relationship("CommissionRecord", back_populates="audit_logs")


class BalanceChange(Base):
    __tablename__ = "balance_changes"

    id = Column(Integer, primary_key=True, index=True)
    commission_record_id = Column(Integer, ForeignKey("commission_records.id"))
    manager_code = Column(String, index=True)
    manager_name = Column(String)
    change_type = Column(String)
    amount = Column(Float)
    balance_before = Column(Float)
    balance_after = Column(Float)
    source_type = Column(String)
    source_reference = Column(String)
    is_pending_confirmation = Column(Boolean, default=False)
    recorded_at = Column(DateTime, default=datetime.now)
    recorded_by = Column(String)

    commission_record = relationship("CommissionRecord", back_populates="balance_changes")


class SelfCheckResult(Base):
    __tablename__ = "self_check_results"

    id = Column(Integer, primary_key=True, index=True)
    check_type = Column(String, nullable=False)
    check_name = Column(String, nullable=False)
    passed = Column(Boolean, default=False)
    message = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    affected_record_ids = Column(Text, nullable=True)
    checked_at = Column(DateTime, default=datetime.now)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"), nullable=True)


class HolidayAdjustment(Base):
    __tablename__ = "holiday_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    original_date = Column(DateTime, nullable=False)
    adjusted_date = Column(DateTime, nullable=False)
    reason = Column(String, nullable=False)
    reviewed_by = Column(String, default="老秦")
    reviewed_at = Column(DateTime, default=datetime.now)
    affected_batch_numbers = Column(Text, nullable=True)
