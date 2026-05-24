import enum
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Boolean, Enum, Float
from sqlalchemy.orm import relationship
from database import Base


class CertificateStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRED = "expired"
    INVALID = "invalid"


class SalesOrderStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_RECHECK = "need_recheck"
    NEED_REISSUE = "need_reissue"
    SHIPPED = "shipped"


class ReissueStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class TraceAction(str, enum.Enum):
    MATERIAL_IN = "material_in"
    CERT_CHECK = "cert_check"
    EMBARGO_CHECK = "embargo_check"
    SPLIT_ORDER = "split_order"
    MANUAL_OVERRIDE = "manual_override"
    REISSUE_REQUEST = "reissue_request"
    REISSUE_APPROVED = "reissue_approved"
    RESULT_WRITEBACK = "result_writeback"
    SHIPPED = "shipped"


class ErrorType(str, enum.Enum):
    MISSING_MATERIAL = "missing_material"
    INVALID_STATUS = "invalid_status"
    DUPLICATE_REQUEST = "duplicate_request"
    NEED_REVIEW = "need_review"


class SeedlingBatch(Base):
    __tablename__ = "seedling_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True)
    species = Column(String)
    quantity = Column(Integer)
    origin = Column(String)
    production_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)

    certificates = relationship("QuarantineCertificate", back_populates="batch")
    sales_orders = relationship("SalesOrder", back_populates="batch")


class QuarantineCertificate(Base):
    __tablename__ = "quarantine_certificates"

    id = Column(Integer, primary_key=True, index=True)
    cert_no = Column(String, unique=True, index=True)
    batch_id = Column(Integer, ForeignKey("seedling_batches.id"))
    issue_date = Column(Date)
    expiry_date = Column(Date)
    issuer = Column(String)
    status = Column(Enum(CertificateStatus), default=CertificateStatus.VALID)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("SeedlingBatch", back_populates="certificates")


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(Integer, primary_key=True, index=True)
    region_code = Column(String, unique=True, index=True)
    region_name = Column(String)
    is_embargoed = Column(Boolean, default=False)
    embargo_reason = Column(String, nullable=True)
    embargo_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    batch_id = Column(Integer, ForeignKey("seedling_batches.id"))
    cert_id = Column(Integer, ForeignKey("quarantine_certificates.id"), nullable=True)
    destination_id = Column(Integer, ForeignKey("destinations.id"))
    quantity = Column(Integer)
    customer = Column(String)
    status = Column(Enum(SalesOrderStatus), default=SalesOrderStatus.PENDING)
    parent_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=True)
    is_split = Column(Boolean, default=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("SeedlingBatch", back_populates="sales_orders")
    destination = relationship("Destination")
    certificate = relationship("QuarantineCertificate")
    reissues = relationship("ReissueApplication", back_populates="order")
    traces = relationship("ProcessingTrace", back_populates="order")
    shipping_report = relationship("ShippingReport", back_populates="order", uselist=False)


class ReissueApplication(Base):
    __tablename__ = "reissue_applications"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    application_no = Column(String, unique=True, index=True)
    reason = Column(Text)
    status = Column(Enum(ReissueStatus), default=ReissueStatus.PENDING)
    new_cert_id = Column(Integer, ForeignKey("quarantine_certificates.id"), nullable=True)
    reviewer = Column(String, nullable=True)
    review_remark = Column(Text, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("SalesOrder", back_populates="reissues")
    new_certificate = relationship("QuarantineCertificate")


class ShippingReport(Base):
    __tablename__ = "shipping_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String, unique=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    ship_date = Column(Date)
    ship_quantity = Column(Integer)
    logistics_info = Column(String)
    cert_verified = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("SalesOrder", back_populates="shipping_report")


class ProcessingTrace(Base):
    __tablename__ = "processing_traces"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("sales_orders.id"))
    action = Column(Enum(TraceAction))
    operator = Column(String, default="system")
    detail = Column(Text)
    result = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("SalesOrder", back_populates="traces")
