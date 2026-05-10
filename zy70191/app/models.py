import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class SupplierType(str, enum.Enum):
    PRIMARY = "primary"
    ALTERNATIVE = "alternative"


class SupplierStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    EXCEPTION = "exception"


class QualificationStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRED = "expired"
    PENDING = "pending"


class SwitchStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ExceptionType(str, enum.Enum):
    QUALIFICATION_FAILED = "qualification_failed"
    PRICE_ABNORMAL = "price_abnormal"
    DELIVERY_DELAY = "delivery_delay"
    DUPLICATE_REQUEST = "duplicate_request"
    INSUFFICIENT_STOCK = "insufficient_stock"
    SYSTEM_ERROR = "system_error"


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    type = Column(String(20), nullable=False)
    status = Column(String(20), default=SupplierStatus.ACTIVE)
    contact_person = Column(String(50))
    phone = Column(String(20))
    address = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    qualifications = relationship("Qualification", back_populates="supplier", cascade="all, delete-orphan")
    price_snapshots = relationship("PriceSnapshot", back_populates="supplier", cascade="all, delete-orphan")


class Qualification(Base):
    __tablename__ = "qualifications"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    name = Column(String(100), nullable=False)
    certificate_number = Column(String(50), nullable=False)
    issue_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    status = Column(String(20), default=QualificationStatus.VALID)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="qualifications")


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_code = Column(String(50), nullable=False)
    product_name = Column(String(100), nullable=False)
    unit_price = Column(Float, nullable=False)
    effective_date = Column(DateTime, default=datetime.utcnow)
    is_current = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="price_snapshots")


class SwitchRequest(Base):
    __tablename__ = "switch_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_no = Column(String(50), unique=True, nullable=False)
    primary_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    alternative_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    product_code = Column(String(50), nullable=False)
    product_name = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(20), default=SwitchStatus.PENDING)
    requester = Column(String(50), nullable=False)
    requester_department = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    approvals = relationship("Approval", back_populates="switch_request", cascade="all, delete-orphan")
    delivery_impacts = relationship("DeliveryImpact", back_populates="switch_request", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionRecord", back_populates="switch_request", cascade="all, delete-orphan")
    reports = relationship("SwitchReport", back_populates="switch_request", cascade="all, delete-orphan")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    switch_request_id = Column(Integer, ForeignKey("switch_requests.id"), nullable=False)
    approver = Column(String(50), nullable=False)
    approver_department = Column(String(50))
    approval_level = Column(Integer, default=1)
    status = Column(String(20), default=ApprovalStatus.PENDING)
    comment = Column(Text)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    switch_request = relationship("SwitchRequest", back_populates="approvals")


class DeliveryImpact(Base):
    __tablename__ = "delivery_impacts"

    id = Column(Integer, primary_key=True, index=True)
    switch_request_id = Column(Integer, ForeignKey("switch_requests.id"), nullable=False)
    original_delivery_date = Column(DateTime, nullable=False)
    new_delivery_date = Column(DateTime, nullable=False)
    delay_days = Column(Integer, nullable=False)
    impact_description = Column(Text)
    mitigation_measures = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    switch_request = relationship("SwitchRequest", back_populates="delivery_impacts")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    switch_request_id = Column(Integer, ForeignKey("switch_requests.id"), nullable=True)
    exception_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    detail = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(50))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    switch_request = relationship("SwitchRequest", back_populates="exceptions")


class SwitchReport(Base):
    __tablename__ = "switch_reports"

    id = Column(Integer, primary_key=True, index=True)
    switch_request_id = Column(Integer, ForeignKey("switch_requests.id"), nullable=False)
    report_no = Column(String(50), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    generated_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    switch_request = relationship("SwitchRequest", back_populates="reports")
