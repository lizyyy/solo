import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Date, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "已提交"
    REVIEWING = "审批中"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    CANCELLED = "已撤件"
    LOANED = "已放款"
    PENDING_REVIEW = "待复核"


class CancellationReason(str, enum.Enum):
    CUSTOMER_REGRET = "客户反悔"
    DOC_EXPIRED = "资料过期"
    RISK_REJECTED = "风控拒绝"
    OTHER = "其他原因"


class RiskResult(str, enum.Enum):
    PASSED = "通过"
    REJECTED = "拒绝"
    PENDING = "待审核"
    REVIEW_REQUIRED = "需复核"


class ReviewStatus(str, enum.Enum):
    NORMAL = "正常"
    PENDING = "待复核"
    SUSPICIOUS = "有疑点"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    id_card = Column(String(18), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    phone = Column(String(20))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    applications = relationship("LoanApplication", back_populates="customer")


class LoanApplication(Base):
    __tablename__ = "loan_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String(32), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    loan_amount = Column(Float, nullable=False)
    loan_term = Column(Integer)
    status = Column(String(20), default=ApplicationStatus.SUBMITTED.value)
    review_status = Column(String(20), default=ReviewStatus.NORMAL.value)
    submitted_at = Column(DateTime, default=func.now())
    approved_at = Column(DateTime)
    loaned_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="applications")
    documents = relationship("CustomerDocument", back_populates="application")
    risk_results = relationship("RiskAssessment", back_populates="application")
    cancellations = relationship("CancellationRecord", back_populates="application")
    followups = relationship("FollowupRecord", back_populates="application")
    status_history = relationship("StatusHistory", back_populates="application")


class CustomerDocument(Base):
    __tablename__ = "customer_documents"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    doc_type = Column(String(50), nullable=False)
    doc_no = Column(String(100))
    issue_date = Column(Date)
    expiry_date = Column(Date)
    is_valid = Column(Boolean, default=True)
    verified_by = Column(String(50))
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    version = Column(Integer, default=1)

    application = relationship("LoanApplication", back_populates="documents")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    risk_score = Column(Integer)
    risk_level = Column(String(20))
    result = Column(String(20), default=RiskResult.PENDING.value)
    reviewer = Column(String(50))
    review_comment = Column(Text)
    assessed_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())

    application = relationship("LoanApplication", back_populates="risk_results")


class CancellationRecord(Base):
    __tablename__ = "cancellation_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    cancellation_no = Column(String(32), unique=True, index=True, nullable=False)
    reason = Column(String(50), nullable=False)
    reason_detail = Column(Text)
    operator = Column(String(50))
    cancelled_at = Column(DateTime, default=func.now())
    is_idempotent = Column(Boolean, default=False)
    idempotent_key = Column(String(64), index=True)
    created_at = Column(DateTime, default=func.now())

    application = relationship("LoanApplication", back_populates="cancellations")


class FollowupRecord(Base):
    __tablename__ = "followup_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    followup_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    operator = Column(String(50))
    followup_at = Column(DateTime, default=func.now())
    next_followup_at = Column(DateTime)
    is_original = Column(Boolean, default=True)
    parent_id = Column(Integer)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=func.now())

    application = relationship("LoanApplication", back_populates="followups")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    from_status = Column(String(20))
    to_status = Column(String(20))
    operator = Column(String(50))
    remark = Column(Text)
    changed_at = Column(DateTime, default=func.now())

    application = relationship("LoanApplication", back_populates="status_history")


class CancellationList(Base):
    __tablename__ = "cancellation_lists"

    id = Column(Integer, primary_key=True, index=True)
    list_no = Column(String(32), unique=True, index=True, nullable=False)
    batch_date = Column(Date, nullable=False)
    total_count = Column(Integer, default=0)
    customer_regret_count = Column(Integer, default=0)
    doc_expired_count = Column(Integer, default=0)
    risk_rejected_count = Column(Integer, default=0)
    operator = Column(String(50))
    exported_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())

    items = relationship("CancellationListItem", back_populates="cancellation_list")


class CancellationListItem(Base):
    __tablename__ = "cancellation_list_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("cancellation_lists.id"))
    application_id = Column(Integer, ForeignKey("loan_applications.id"))
    cancellation_id = Column(Integer, ForeignKey("cancellation_records.id"))
    customer_name = Column(String(50))
    id_card = Column(String(18))
    application_no = Column(String(32))
    loan_amount = Column(Float)
    cancellation_reason = Column(String(50))
    review_status = Column(String(20), default=ReviewStatus.NORMAL.value)
    review_remark = Column(Text)
    warnings = Column(Text)

    cancellation_list = relationship("CancellationList", back_populates="items")