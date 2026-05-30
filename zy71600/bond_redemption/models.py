from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class ProvenanceMixin:
    source_type = Column(String(32), nullable=False, default="manual")
    source_detail = Column(Text, nullable=True)
    quality_status = Column(String(16), nullable=False, default="normal")
    anomaly_notes = Column(JSON, nullable=True, default=list)
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class BondLedger(Base, ProvenanceMixin):
    __tablename__ = "bond_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_code = Column(String(32), nullable=False, unique=True)
    bond_name = Column(String(128), nullable=False)
    issuer = Column(String(128), nullable=True)
    face_value = Column(Float, nullable=False)
    coupon_rate = Column(Float, nullable=False)
    issue_date = Column(Date, nullable=True)
    maturity_date = Column(Date, nullable=False)
    redemption_type = Column(String(32), nullable=False, default="到期赎回")
    status = Column(String(16), nullable=False, default="存续")

    coupons = relationship("CouponSchedule", back_populates="bond", cascade="all, delete-orphan")
    notices = relationship("RedemptionNotice", back_populates="bond", cascade="all, delete-orphan")
    receipts = relationship("CustodyReceipt", back_populates="bond", cascade="all, delete-orphan")
    warnings = relationship("WarningSheet", back_populates="bond", cascade="all, delete-orphan")


class CouponSchedule(Base, ProvenanceMixin):
    __tablename__ = "coupon_schedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_id = Column(Integer, ForeignKey("bond_ledger.id"), nullable=False)
    payment_date = Column(Date, nullable=False)
    coupon_amount = Column(Float, nullable=False)
    coupon_period = Column(String(16), nullable=True)
    is_paid = Column(Boolean, nullable=False, default=False)
    is_duplicate = Column(Boolean, nullable=False, default=False)

    bond = relationship("BondLedger", back_populates="coupons")


class RedemptionNotice(Base, ProvenanceMixin):
    __tablename__ = "redemption_notice"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_id = Column(Integer, ForeignKey("bond_ledger.id"), nullable=False)
    notice_date = Column(Date, nullable=False)
    redemption_date = Column(Date, nullable=False)
    redemption_price = Column(Float, nullable=False)
    notice_version = Column(Integer, nullable=False, default=1)
    is_latest = Column(Boolean, nullable=False, default=True)
    notice_title = Column(String(256), nullable=True)
    is_late = Column(Boolean, nullable=False, default=False)

    bond = relationship("BondLedger", back_populates="notices")


class CustodyReceipt(Base, ProvenanceMixin):
    __tablename__ = "custody_receipt"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_id = Column(Integer, ForeignKey("bond_ledger.id"), nullable=False)
    receipt_date = Column(Date, nullable=False)
    receipt_amount = Column(Float, nullable=False)
    custodian = Column(String(128), nullable=True)
    receipt_no = Column(String(64), nullable=True)
    is_matched = Column(Boolean, nullable=False, default=False)
    matched_to = Column(String(64), nullable=True)

    bond = relationship("BondLedger", back_populates="receipts")


class FundCalendar(Base, ProvenanceMixin):
    __tablename__ = "fund_calendar"

    id = Column(Integer, primary_key=True, autoincrement=True)
    calendar_date = Column(Date, nullable=False, unique=True)
    expected_inflow = Column(Float, nullable=False, default=0.0)
    expected_outflow = Column(Float, nullable=False, default=0.0)
    actual_inflow = Column(Float, nullable=True)
    actual_outflow = Column(Float, nullable=True)
    description = Column(Text, nullable=True)


class WarningSheet(Base, ProvenanceMixin):
    __tablename__ = "warning_sheet"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_id = Column(Integer, ForeignKey("bond_ledger.id"), nullable=True)
    warning_type = Column(String(32), nullable=False)
    warning_level = Column(String(16), nullable=False, default="info")
    description = Column(Text, nullable=False)
    affected_records = Column(JSON, nullable=True, default=list)
    status = Column(String(16), nullable=False, default="open")
    resolution = Column(Text, nullable=True)
    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    bond = relationship("BondLedger", back_populates="warnings")
