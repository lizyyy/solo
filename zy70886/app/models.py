from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class ReconciliationStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHED = "matched"
    DISCREPANCY = "discrepancy"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"


class DiscrepancyType(str, enum.Enum):
    UNAUTHORIZED_STAMP = "unauthorized_stamp"
    SUPPLEMENTARY_ATTACHMENT = "supplementary_attachment"
    WITHDRAWAL_RESUBMIT = "withdrawal_resubmit"
    MISSING_APPROVAL = "missing_approval"
    MISSING_STAMP = "missing_stamp"
    MISSING_EXPRESS = "missing_express"
    AMOUNT_MISMATCH = "amount_mismatch"
    DATE_MISMATCH = "date_mismatch"
    OTHER = "other"


class ReviewAction(str, enum.Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_SUPPLEMENT = "request_supplement"
    REVISE = "revise"


class ContractApplication(Base):
    __tablename__ = "contract_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, unique=True, index=True, nullable=False)
    contract_name = Column(String, nullable=False)
    contract_amount = Column(Float)
    applicant = Column(String)
    department = Column(String)
    application_date = Column(DateTime)
    counterparty = Column(String)
    stamp_type = Column(String)
    stamp_count = Column(Integer, default=1)
    is_urgent = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    stamp_records = relationship("StampRecord", back_populates="application")
    approval_records = relationship("ApprovalRecord", back_populates="application")
    express_records = relationship("ExpressRecord", back_populates="application")
    reconciliation_results = relationship("ReconciliationResult", back_populates="application")


class StampRecord(Base):
    __tablename__ = "stamp_records"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, ForeignKey("contract_applications.application_no"), index=True)
    stamp_date = Column(DateTime)
    stamp_operator = Column(String)
    stamp_type = Column(String)
    stamp_count = Column(Integer, default=1)
    is_supplementary = Column(Boolean, default=False)
    supplementary_reason = Column(String)
    is_withdrawn = Column(Boolean, default=False)
    withdrawal_reason = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    application = relationship("ContractApplication", back_populates="stamp_records")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, ForeignKey("contract_applications.application_no"), index=True)
    approval_level = Column(String)
    approver = Column(String)
    approval_date = Column(DateTime)
    approval_result = Column(String)
    approval_opinion = Column(Text)
    is_authorised = Column(Boolean, default=False)
    authorisation_scope = Column(String)
    created_at = Column(DateTime, server_default=func.now())

    application = relationship("ContractApplication", back_populates="approval_records")


class ExpressRecord(Base):
    __tablename__ = "express_records"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, ForeignKey("contract_applications.application_no"), index=True)
    express_company = Column(String)
    tracking_no = Column(String)
    recipient = Column(String)
    recipient_phone = Column(String)
    recipient_address = Column(String)
    send_date = Column(DateTime)
    receive_date = Column(DateTime)
    is_received = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    application = relationship("ContractApplication", back_populates="express_records")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, ForeignKey("contract_applications.application_no"), index=True)
    batch_id = Column(String, index=True)
    status = Column(Enum(ReconciliationStatus), default=ReconciliationStatus.PENDING)
    discrepancy_types = Column(String)
    discrepancy_description = Column(Text)
    is_unauthorized_stamp = Column(Boolean, default=False)
    is_supplementary_attachment = Column(Boolean, default=False)
    is_withdrawal_resubmit = Column(Boolean, default=False)
    has_missing_approval = Column(Boolean, default=False)
    has_missing_stamp = Column(Boolean, default=False)
    has_missing_express = Column(Boolean, default=False)
    review_status = Column(String)
    review_action = Column(String)
    reviewer = Column(String)
    review_date = Column(DateTime)
    review_opinion = Column(Text)
    final_disposition = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    application = relationship("ContractApplication", back_populates="reconciliation_results")
    review_histories = relationship("ReviewHistory", back_populates="reconciliation_result")


class ReviewHistory(Base):
    __tablename__ = "review_histories"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_result_id = Column(Integer, ForeignKey("reconciliation_results.id"), index=True)
    action = Column(Enum(ReviewAction))
    reviewer = Column(String)
    review_date = Column(DateTime, server_default=func.now())
    opinion = Column(Text)
    old_status = Column(String)
    new_status = Column(String)
    change_summary = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    reconciliation_result = relationship("ReconciliationResult", back_populates="review_histories")


class ReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    batch_name = Column(String)
    total_records = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    discrepancy_count = Column(Integer, default=0)
    reviewed_count = Column(Integer, default=0)
    approved_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    status = Column(String, default="processing")
    created_by = Column(String)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
