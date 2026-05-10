from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Text, Enum, Index
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ReceiptStatus(str, enum.Enum):
    UNMATCHED = "unmatched"
    MATCHED = "matched"
    PENDING_CLAIM = "pending_claim"
    CLAIMING = "claiming"
    CLAIMED = "claimed"
    PARTIAL_CLAIMED = "partial_claimed"
    REFUNDED = "refunded"


class ClaimStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class InvoiceStatus(str, enum.Enum):
    UNRECONCILED = "unreconciled"
    PARTIAL = "partial"
    RECONCILED = "reconciled"


class RefundStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_no = Column(String(64), unique=True, index=True, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    paid_at = Column(DateTime, nullable=False)
    payer_name = Column(String(128), nullable=True)
    payer_account = Column(String(64), nullable=True)
    payer_bank = Column(String(128), nullable=True)
    remark = Column(Text, nullable=True)
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.UNMATCHED, nullable=False)
    remaining_amount = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    claims = relationship("Claim", back_populates="receipt")
    refunds = relationship("Refund", back_populates="receipt")

    __table_args__ = (
        Index("ix_receipts_status", "status"),
    )


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_no = Column(String(64), unique=True, index=True, nullable=False)
    contract_name = Column(String(256), nullable=False)
    customer_name = Column(String(128), nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=False)
    received_amount = Column(Numeric(18, 2), default=Decimal("0"), nullable=False)
    signed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    invoices = relationship("Invoice", back_populates="contract")
    claims = relationship("Claim", back_populates="contract")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_no = Column(String(64), unique=True, index=True, nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    reconciled_amount = Column(Numeric(18, 2), default=Decimal("0"), nullable=False)
    issued_at = Column(DateTime, nullable=True)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.UNRECONCILED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contract = relationship("Contract", back_populates="invoices")
    reconciliations = relationship("Reconciliation", back_populates="invoice")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_no = Column(String(64), unique=True, index=True, nullable=False)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    status = Column(Enum(ClaimStatus), default=ClaimStatus.PENDING, nullable=False)
    applicant = Column(String(64), nullable=False)
    applicant_remark = Column(Text, nullable=True)
    approver = Column(String(64), nullable=True)
    approve_remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    receipt = relationship("Receipt", back_populates="claims")
    contract = relationship("Contract", back_populates="claims")
    reconciliations = relationship("Reconciliation", back_populates="claim")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    reconciled_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    claim = relationship("Claim", back_populates="reconciliations")
    invoice = relationship("Invoice", back_populates="reconciliations")


class Refund(Base):
    __tablename__ = "refunds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    refund_no = Column(String(64), unique=True, index=True, nullable=False)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(Enum(RefundStatus), default=RefundStatus.PENDING, nullable=False)
    operator = Column(String(64), nullable=False)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    receipt = relationship("Receipt", back_populates="refunds")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_type = Column(String(64), nullable=False)
    target_id = Column(Integer, nullable=False)
    action = Column(String(64), nullable=False)
    from_status = Column(String(64), nullable=True)
    to_status = Column(String(64), nullable=True)
    operator = Column(String(64), nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_operation_logs_target", "target_type", "target_id"),
    )
