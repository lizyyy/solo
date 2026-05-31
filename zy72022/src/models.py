from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    Column, String, Float, DateTime, Integer, Text, Boolean,
    ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class RecordStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SUSPENDED = "suspended"
    CONFLICT = "conflict"
    REFUNDED = "refunded"


class EvidenceType(str, Enum):
    PAYMENT_FLOW = "payment_flow"
    REFUND_REQUEST = "refund_request"
    APPROVAL_EMAIL = "approval_email"
    MANUAL_NOTE = "manual_note"
    CONTRACT_SCAN = "contract_scan"
    ATTACHMENT_INDEX = "attachment_index"


class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id = Column(String(64), primary_key=True)
    transaction_no = Column(String(64), nullable=False, index=True)
    payer = Column(String(128), nullable=False)
    payee = Column(String(128), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(16), default="CNY")
    transaction_time = Column(DateTime, nullable=False, index=True)
    bank_reference = Column(String(64))
    remark = Column(Text)
    source_file = Column(String(256))
    source_type = Column(String(32), default="payment_flow")
    raw_data = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("idx_payment_transaction", "transaction_no", "transaction_time"),
    )


class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id = Column(String(64), primary_key=True)
    request_no = Column(String(64), nullable=False, index=True)
    related_transaction_no = Column(String(64), index=True)
    applicant = Column(String(128))
    reason = Column(Text)
    amount = Column(Float, nullable=False)
    request_time = Column(DateTime, nullable=False)
    status = Column(String(32))
    approver = Column(String(128))
    approval_time = Column(DateTime)
    source_file = Column(String(256))
    raw_data = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ApprovalEmail(Base):
    __tablename__ = "approval_emails"

    id = Column(String(64), primary_key=True)
    email_id = Column(String(128))
    subject = Column(String(256))
    sender = Column(String(128))
    recipients = Column(Text)
    sent_time = Column(DateTime, nullable=False)
    related_transaction_no = Column(String(64), index=True)
    related_request_no = Column(String(64), index=True)
    content = Column(Text)
    approval_decision = Column(String(32))
    approved_amount = Column(Float)
    source_file = Column(String(256))
    raw_data = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ManualNote(Base):
    __tablename__ = "manual_notes"

    id = Column(String(64), primary_key=True)
    note_no = Column(String(64))
    author = Column(String(128), nullable=False)
    note_time = Column(DateTime, nullable=False)
    related_transaction_no = Column(String(64), index=True)
    related_request_no = Column(String(64), index=True)
    content = Column(Text, nullable=False)
    is_override = Column(Boolean, default=False)
    source_file = Column(String(256))
    raw_data = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class AttachmentIndex(Base):
    __tablename__ = "attachment_indices"

    id = Column(String(64), primary_key=True)
    attachment_no = Column(String(64), nullable=False)
    related_transaction_no = Column(String(64), index=True)
    related_request_no = Column(String(64), index=True)
    file_name = Column(String(256))
    file_path = Column(String(512))
    file_type = Column(String(32))
    document_type = Column(String(64))
    description = Column(Text)
    upload_time = Column(DateTime)
    source_file = Column(String(256))
    raw_data = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class AuctionDeposit(Base):
    __tablename__ = "auction_deposits"

    id = Column(String(64), primary_key=True)
    deposit_no = Column(String(64), nullable=False, index=True)
    transaction_no = Column(String(64), index=True)
    related_batch = Column(String(64), index=True)
    payer = Column(String(128))
    amount = Column(Float, nullable=False)
    currency = Column(String(16), default="CNY")

    payment_time = Column(DateTime)
    refund_time = Column(DateTime)
    refund_amount = Column(Float, default=0.0)

    status = Column(String(32), default=RecordStatus.PENDING.value)
    is_deposit = Column(Boolean, default=False)

    confirmed_amount = Column(Float, default=0.0)
    suspended_amount = Column(Float, default=0.0)

    contract_amount = Column(Float)
    contract_terms = Column(Text)
    contract_file = Column(String(256))

    decision_reason = Column(Text)
    decision_made_by = Column(String(128), default="system")
    decision_time = Column(DateTime)

    source_evidence = Column(Text)
    evidence_chain = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("idx_deposit_batch", "related_batch", "transaction_no"),
    )


class EvidenceLink(Base):
    __tablename__ = "evidence_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deposit_id = Column(String(64), ForeignKey("auction_deposits.id"), nullable=False, index=True)
    evidence_type = Column(String(32), nullable=False)
    evidence_id = Column(String(64), nullable=False)
    evidence_source = Column(String(256))
    evidence_content = Column(Text)
    relevance_score = Column(Float, default=0.0)

    linked_at = Column(DateTime, default=datetime.now)
    linked_by = Column(String(128), default="system")


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(String(64), primary_key=True)
    deposit_id = Column(String(64), ForeignKey("auction_deposits.id"), nullable=False, index=True)
    conflict_type = Column(String(64))
    side_a_source = Column(String(256))
    side_a_value = Column(Text)
    side_a_evidence = Column(Text)
    side_b_source = Column(String(256))
    side_b_value = Column(Text)
    side_b_evidence = Column(Text)
    suggested_action = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(128))
    resolved_time = Column(DateTime)
    resolution = Column(Text)

    created_at = Column(DateTime, default=datetime.now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deposit_id = Column(String(64), ForeignKey("auction_deposits.id"), index=True)
    action = Column(String(64), nullable=False)
    old_status = Column(String(32))
    new_status = Column(String(32))
    old_amount = Column(Float)
    new_amount = Column(Float)
    reason = Column(Text)
    operator = Column(String(128), default="system")
    operation_time = Column(DateTime, default=datetime.now)
    source_module = Column(String(64))


class ProcessingState(Base):
    __tablename__ = "processing_states"

    id = Column(String(64), primary_key=True)
    file_name = Column(String(256), nullable=False)
    file_hash = Column(String(64))
    last_processed = Column(DateTime)
    record_count = Column(Integer, default=0)
    status = Column(String(32))
    error_message = Column(Text)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
