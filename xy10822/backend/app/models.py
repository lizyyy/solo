import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from .database import Base


class ReconciliationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    MATCHED = "matched"
    DISCREPANCY = "discrepancy"
    RESOLVED = "resolved"
    FAILED = "failed"
    EXPORTED = "exported"


class DiscrepancyType(str, enum.Enum):
    AMOUNT_MISMATCH = "amount_mismatch"
    MISSING_INTERNAL = "missing_internal"
    MISSING_CHANNEL = "missing_channel"
    STATUS_MISMATCH = "status_mismatch"
    REFUND_MISMATCH = "refund_mismatch"
    DUPLICATE = "duplicate"
    OTHER = "other"


class ActionType(str, enum.Enum):
    IMPORT = "import"
    FETCH = "fetch"
    RECONCILE = "reconcile"
    MARK_RESOLVED = "mark_resolved"
    MARK_FAILED = "mark_failed"
    EXPORT = "export"
    MANUAL_ADJUST = "manual_adjust"


class ChannelTransaction(Base):
    __tablename__ = "channel_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True)
    channel = Column(String, index=True)
    amount = Column(Float)
    currency = Column(String, default="CNY")
    transaction_time = Column(DateTime)
    status = Column(String)
    order_no = Column(String, index=True)
    raw_data = Column(Text)
    batch_id = Column(Integer, ForeignKey("reconciliation_batches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ReconciliationBatch", back_populates="channel_transactions")
    discrepancies = relationship("Discrepancy", back_populates="channel_transaction")


class InternalOrder(Base):
    __tablename__ = "internal_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    amount = Column(Float)
    currency = Column(String, default="CNY")
    status = Column(String)
    payment_method = Column(String)
    created_time = Column(DateTime)
    paid_time = Column(DateTime, nullable=True)
    raw_data = Column(Text)
    batch_id = Column(Integer, ForeignKey("reconciliation_batches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ReconciliationBatch", back_populates="internal_orders")
    refunds = relationship("RefundRecord", back_populates="order")
    discrepancies = relationship("Discrepancy", back_populates="internal_order")


class RefundRecord(Base):
    __tablename__ = "refund_records"

    id = Column(Integer, primary_key=True, index=True)
    refund_id = Column(String, unique=True, index=True)
    order_no = Column(String, ForeignKey("internal_orders.order_no"))
    amount = Column(Float)
    status = Column(String)
    refund_time = Column(DateTime)
    channel_refund_id = Column(String, nullable=True)
    raw_data = Column(Text)
    batch_id = Column(Integer, ForeignKey("reconciliation_batches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("InternalOrder", back_populates="refunds")
    batch = relationship("ReconciliationBatch", back_populates="refunds")


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True)
    channel = Column(String)
    reconciliation_date = Column(DateTime)
    status = Column(Enum(ReconciliationStatus), default=ReconciliationStatus.PENDING)
    total_channel_count = Column(Integer, default=0)
    total_channel_amount = Column(Float, default=0)
    total_internal_count = Column(Integer, default=0)
    total_internal_amount = Column(Float, default=0)
    matched_count = Column(Integer, default=0)
    discrepancy_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    channel_transactions = relationship("ChannelTransaction", back_populates="batch")
    internal_orders = relationship("InternalOrder", back_populates="batch")
    refunds = relationship("RefundRecord", back_populates="batch")
    discrepancies = relationship("Discrepancy", back_populates="batch")
    history = relationship("ProcessingHistory", back_populates="batch")


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("reconciliation_batches.id"))
    discrepancy_type = Column(Enum(DiscrepancyType))
    channel_transaction_id = Column(Integer, ForeignKey("channel_transactions.id"), nullable=True)
    internal_order_id = Column(Integer, ForeignKey("internal_orders.id"), nullable=True)
    description = Column(Text)
    expected_amount = Column(Float, nullable=True)
    actual_amount = Column(Float, nullable=True)
    status = Column(Enum(ReconciliationStatus), default=ReconciliationStatus.DISCREPANCY)
    resolved_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ReconciliationBatch", back_populates="discrepancies")
    channel_transaction = relationship("ChannelTransaction", back_populates="discrepancies")
    internal_order = relationship("InternalOrder", back_populates="discrepancies")
    history = relationship("ProcessingHistory", back_populates="discrepancy")


class ProcessingHistory(Base):
    __tablename__ = "processing_history"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("reconciliation_batches.id"), nullable=True)
    discrepancy_id = Column(Integer, ForeignKey("discrepancies.id"), nullable=True)
    action_type = Column(Enum(ActionType))
    status = Column(String)
    operator = Column(String, default="system")
    details = Column(Text)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("ReconciliationBatch", back_populates="history")
    discrepancy = relationship("Discrepancy", back_populates="history")
