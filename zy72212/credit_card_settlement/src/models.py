from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class RecordStatus:
    PENDING_IMPORT = "pending_import"
    ABNEED_REVIEW = "abnormal_need_review"
    PENDING_FUND_ACCOUNTING = "pending_fund_accounting"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    RESOLVED = "resolved"


class NextOwner:
    FUND_ACCOUNTING_LIN = "fund_accounting_lin"
    FINANCIAL_REVIEWER = "financial_reviewer"


class SettlementBatch(Base):
    __tablename__ = "settlement_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    import_date = Column(DateTime, default=datetime.now)
    imported_by = Column(String(50), default="system")
    total_records = Column(Integer, default=0)
    remark = Column(Text, default="")

    records = relationship("SettlementRecord", back_populates="batch")


class SettlementRecord(Base):
    __tablename__ = "settlement_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("settlement_batches.id"), nullable=False)
    serial_no = Column(String(100), nullable=False)
    org_name = Column(String(200), nullable=False)
    org_name_std = Column(String(200), default="")
    card_no = Column(String(50), nullable=False)
    amount = Column(String(50), nullable=False)
    settlement_date = Column(String(20), nullable=False)
    original_org_name = Column(String(200), default="")

    status = Column(String(30), default=RecordStatus.PENDING_IMPORT)
    org_name_consistent = Column(Boolean, default=True)
    org_name_expected = Column(String(200), default="")

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("SettlementBatch", back_populates="records")
    supplementary = relationship("SupplementaryRecord", back_populates="record", uselist=False)
    holiday_note = relationship("HolidayNote", back_populates="record", uselist=False)


class HolidayNote(Base):
    __tablename__ = "holiday_notes"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("settlement_records.id"), nullable=False)
    note = Column(Text, nullable=False)
    reviewed_by = Column(String(50), default="fund_accounting_lin")
    reviewed_at = Column(DateTime, default=datetime.now)

    record = relationship("SettlementRecord", back_populates="holiday_note")


class SupplementaryRecord(Base):
    __tablename__ = "supplementary_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("settlement_records.id"), nullable=False)
    reason_kept = Column(Text, default="")
    missing_materials = Column(Text, default="")
    next_owner = Column(String(50), default=NextOwner.FINANCIAL_REVIEWER)
    source_batch_no = Column(String(50), default="")
    trace_info = Column(Text, default="")
    updated_by = Column(String(50), default="")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    record = relationship("SettlementRecord", back_populates="supplementary")
