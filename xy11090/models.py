from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from enum import Enum


class ReductionStatus(str, Enum):
    DRAFT = "草稿"
    IMPORTED = "已导入"
    PROCESSING = "处理中"
    PENDING_REVIEW = "待复核"
    PENDING_MANUAL = "待人工处理"
    APPROVED = "已通过"
    REJECTED = "已驳回"


class ReductionType(str, Enum):
    MARKET_CLOSURE = "临时休市减免"
    PERSONAL_LEAVE = "个人请假减免"
    DIFFICULTY_SUBSIDY = "困难补助"
    POLICY_PREFERENTIAL = "政策优惠"


class InvoiceStatus(str, Enum):
    NOT_ISSUED = "未开票"
    ISSUED = "已开票"
    CANCELLED = "已作废"
    LOST = "已遗失"


class Stall(Base):
    __tablename__ = "stalls"

    id = Column(Integer, primary_key=True, index=True)
    stall_number = Column(String(20), unique=True, index=True, nullable=False)
    stall_area = Column(Float, nullable=False)
    stall_type = Column(String(30), nullable=False)
    market_zone = Column(String(30), nullable=False)
    monthly_fee_standard = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor = relationship("Vendor", back_populates="stall", uselist=False)
    fee_records = relationship("FeeRecord", back_populates="stall")
    reductions = relationship("FeeReduction", back_populates="stall")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"), unique=True)
    vendor_name = Column(String(50), nullable=False)
    id_card_number = Column(String(18), unique=True, nullable=False)
    phone_number = Column(String(11), nullable=False)
    business_scope = Column(String(100), nullable=False)
    contract_start_date = Column(Date, nullable=False)
    contract_end_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stall = relationship("Stall", back_populates="vendor")
    leaves = relationship("PersonalLeave", back_populates="vendor")
    reductions = relationship("FeeReduction", back_populates="vendor")


class MarketClosure(Base):
    __tablename__ = "market_closures"

    id = Column(Integer, primary_key=True, index=True)
    closure_notice_no = Column(String(30), unique=True, nullable=False)
    closure_title = Column(String(100), nullable=False)
    closure_reason = Column(String(200), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    affected_zones = Column(String(200), nullable=False)
    issuer_department = Column(String(50), nullable=False)
    issued_at = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reductions = relationship("FeeReduction", back_populates="closure")


class PersonalLeave(Base):
    __tablename__ = "personal_leaves"

    id = Column(Integer, primary_key=True, index=True)
    leave_no = Column(String(30), unique=True, nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    leave_reason = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_days = Column(Integer, nullable=False)
    approver = Column(String(50), nullable=False)
    approved_at = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor = relationship("Vendor", back_populates="leaves")
    reductions = relationship("FeeReduction", back_populates="leave")


class FeeRecord(Base):
    __tablename__ = "fee_records"

    id = Column(Integer, primary_key=True, index=True)
    stall_id = Column(Integer, ForeignKey("stalls.id"))
    fee_month = Column(String(7), nullable=False)
    fee_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0)
    payment_deadline = Column(Date, nullable=False)
    payment_date = Column(Date)
    invoice_status = Column(String(20), default=InvoiceStatus.NOT_ISSUED)
    invoice_no = Column(String(30))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stall = relationship("Stall", back_populates="fee_records")


class FeeReduction(Base):
    __tablename__ = "fee_reductions"

    id = Column(Integer, primary_key=True, index=True)
    reduction_no = Column(String(30), unique=True, nullable=False)
    stall_id = Column(Integer, ForeignKey("stalls.id"))
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    reduction_type = Column(String(30), nullable=False)
    reduction_month = Column(String(7), nullable=False)
    reduction_amount = Column(Float, nullable=False)
    closure_id = Column(Integer, ForeignKey("market_closures.id"))
    leave_id = Column(Integer, ForeignKey("personal_leaves.id"))
    applicant = Column(String(50), nullable=False)
    application_date = Column(Date, nullable=False)
    review_deadline = Column(Date, nullable=False)
    status = Column(String(20), default=ReductionStatus.DRAFT)
    reject_reason = Column(Text)
    processor = Column(String(50))
    processed_at = Column(Date)
    reviewer = Column(String(50))
    reviewed_at = Column(Date)
    invoice_status = Column(String(20), default=InvoiceStatus.NOT_ISSUED)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    stall = relationship("Stall", back_populates="reductions")
    vendor = relationship("Vendor", back_populates="reductions")
    closure = relationship("MarketClosure", back_populates="reductions")
    leave = relationship("PersonalLeave", back_populates="reductions")
