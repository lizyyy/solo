from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import enum


class AuditType(str, enum.Enum):
    CREATED = "created"
    WEIGHED = "weighed"
    PRICED = "priced"
    DEDUCTED = "deducted"
    SETTLED = "settled"
    REVIEWED = "reviewed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class OperationType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    STATUS_CHANGE = "status_change"
    MANUAL_CORRECTION = "manual_correction"
    CANCEL = "cancel"
    CLOSE = "close"
    SETTLE = "settle"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    contact = Column(String(50))
    address = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    weighings = relationship("WeighingRecord", back_populates="customer")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    code = Column(String(20), unique=True)
    description = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    weighings = relationship("WeighingRecord", back_populates="category")
    prices = relationship("Price", back_populates="category")
    deductions = relationship("DeductionRatio", back_populates="category")


class WeighingRecord(Base):
    __tablename__ = "weighing_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    gross_weight = Column(Float, nullable=False)
    tare_weight = Column(Float, nullable=False)
    net_weight = Column(Float)
    status = Column(String(20), default=AuditType.WEIGHED)
    weigher = Column(String(50))
    weighed_at = Column(DateTime, default=datetime.utcnow)
    price_id = Column(Integer, ForeignKey("prices.id"))
    deduction_id = Column(Integer, ForeignKey("deduction_ratios.id"))
    deducted_weight = Column(Float)
    final_weight = Column(Float)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    created_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remarks = Column(Text)

    customer = relationship("Customer", back_populates="weighings")
    category = relationship("Category", back_populates="weighings")
    price = relationship("Price")
    deduction = relationship("DeductionRatio")
    settlement = relationship("Settlement", back_populates="weighings")
    audit_logs = relationship("AuditLog", back_populates="weighing")


class Price(Base):
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    price = Column(Float, nullable=False)
    version = Column(Integer, default=1)
    effective_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("Category", back_populates="prices")


class DeductionRatio(Base):
    __tablename__ = "deduction_ratios"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String(50))
    ratio = Column(Float, nullable=False)
    version = Column(Integer, default=1)
    effective_date = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True)
    created_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    category = relationship("Category", back_populates="deductions")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    total_weight = Column(Float)
    total_amount = Column(Float)
    status = Column(String(20), default=AuditType.SETTLED)
    settled_by = Column(String(50))
    settled_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    remarks = Column(Text)

    weighings = relationship("WeighingRecord", back_populates="settlement")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    weighing_id = Column(Integer, ForeignKey("weighing_records.id"))
    operation_type = Column(String(50), nullable=False)
    original_data = Column(Text)
    new_data = Column(Text)
    operator = Column(String(50))
    conclusion = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)

    weighing = relationship("WeighingRecord", back_populates="audit_logs")
