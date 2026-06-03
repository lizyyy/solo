from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class ClearingBatch(Base):
    __tablename__ = "clearing_batches"

    id = Column(Integer, primary_key=True)
    batch_no = Column(String(50), unique=True, nullable=False, index=True)
    import_date = Column(DateTime, default=datetime.now)
    source_file = Column(String(200))
    status = Column(String(20), default="pending")
    total_records = Column(Integer, default=0)
    mixed_currency_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    transactions = relationship("TransactionRecord", back_populates="batch", cascade="all, delete-orphan")
    audit_trails = relationship("AuditTrail", back_populates="batch", cascade="all, delete-orphan")
    holiday_notes = relationship("HolidayAdjustment", back_populates="batch", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ClearingBatch(batch_no='{self.batch_no}', status='{self.status}')>"


class TransactionRecord(Base):
    __tablename__ = "transaction_records"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"), nullable=False)
    transaction_date = Column(DateTime)
    transaction_no = Column(String(100))
    summary = Column(String(500))
    amount = Column(Float)
    amount_column_raw = Column(Text)
    currency = Column(String(10))
    has_mixed_currency = Column(Boolean, default=False)
    detected_currencies = Column(String(100))
    counterparty = Column(String(200))
    remark = Column(Text)
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    review_note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ClearingBatch", back_populates="transactions")
    audit_trails = relationship("AuditTrail", back_populates="transaction", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<TransactionRecord(id={self.id}, summary='{self.summary[:30]}...', has_mixed={self.has_mixed_currency})>"


class AuditTrail(Base):
    __tablename__ = "audit_trails"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transaction_records.id"))
    audit_type = Column(String(50))
    status = Column(String(20), default="pending")
    reason = Column(Text)
    missing_materials = Column(Text)
    next_action = Column(String(100))
    responsible_party = Column(String(50))
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ClearingBatch", back_populates="audit_trails")
    transaction = relationship("TransactionRecord", back_populates="audit_trails")

    def __repr__(self):
        return f"<AuditTrail(id={self.id}, type='{self.audit_type}', status='{self.status}')>"


class HolidayAdjustment(Base):
    __tablename__ = "holiday_adjustments"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("clearing_batches.id"), nullable=False)
    original_date = Column(DateTime)
    adjusted_date = Column(DateTime)
    reason = Column(Text)
    operator_note = Column(Text)
    is_applied = Column(Boolean, default=False)
    applied_by = Column(String(50))
    applied_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    batch = relationship("ClearingBatch", back_populates="holiday_notes")

    def __repr__(self):
        return f"<HolidayAdjustment(id={self.id}, batch_id={self.batch_id})>"
