from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    RETURNED = "returned"
    SUPPLEMENT_TAX = "supplement_tax"


class DeclarationItemStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CORRECTION = "needs_correction"
    SUPPLEMENT_TAX = "supplement_tax"


class OperationType(str, enum.Enum):
    CREATE_BATCH = "create_batch"
    PROCESS_ITEM = "process_item"
    RETURN_ITEM = "return_item"
    EXPORT = "export"
    CURRENCY_CONVERT = "currency_convert"
    CATEGORY_MERGE = "category_merge"
    SUPPLEMENT_TAX = "supplement_tax"
    UPDATE_TAX_RATE = "update_tax_rate"


class DeclarationBatch(Base):
    __tablename__ = "declaration_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    declaration_port = Column(String(100))
    declaration_date = Column(DateTime)
    ebp_no = Column(String(100))
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    total_items = Column(Integer, default=0)
    total_amount = Column(Float, default=0)
    total_tax = Column(Float, default=0)
    currency = Column(String(10), default="CNY")
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    remark = Column(Text)

    items = relationship("DeclarationItem", back_populates="batch")
    operations = relationship("OperationLog", back_populates="batch")
    rejection_notices = relationship("RejectionNotice", back_populates="batch")


class DeclarationItem(Base):
    __tablename__ = "declaration_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("declaration_batches.id"))
    item_no = Column(String(50), index=True)
    sku = Column(String(100))
    product_name = Column(String(200))
    specification = Column(String(200))
    hs_code = Column(String(50), index=True)
    origin_country = Column(String(100))
    quantity = Column(Float)
    unit = Column(String(20))
    unit_price = Column(Float)
    total_price = Column(Float)
    currency = Column(String(10))
    exchange_rate = Column(Float, default=1.0)
    total_price_cny = Column(Float)
    tax_rate = Column(Float)
    tax_amount = Column(Float)
    tax_amount_cny = Column(Float)
    category_code = Column(String(50))
    category_name = Column(String(200))
    status = Column(Enum(DeclarationItemStatus), default=DeclarationItemStatus.PENDING)
    is_supplement_tax = Column(Boolean, default=False)
    supplement_tax_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    remark = Column(Text)

    batch = relationship("DeclarationBatch", back_populates="items")
    operations = relationship("OperationLog", back_populates="item")
    tax_certificates = relationship("TaxCertificate", back_populates="item")


class HsCode(Base):
    __tablename__ = "hs_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(500))
    tax_rate = Column(Float)
    additional_tax_rate = Column(Float, default=0)
    unit = Column(String(20))
    category_code = Column(String(50))
    category_name = Column(String(200))
    is_valid = Column(Boolean, default=True)
    effective_date = Column(DateTime)
    expiry_date = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    remark = Column(Text)


class RejectionNotice(Base):
    __tablename__ = "rejection_notices"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("declaration_batches.id"))
    rejection_no = Column(String(100), unique=True, index=True)
    rejection_date = Column(DateTime)
    rejection_reason = Column(Text)
    rejection_type = Column(String(100))
    handler = Column(String(100))
    handled_at = Column(DateTime)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text)

    batch = relationship("DeclarationBatch", back_populates="rejection_notices")


class TaxCertificate(Base):
    __tablename__ = "tax_certificates"

    id = Column(Integer, primary_key=True, index=True)
    certificate_no = Column(String(100), unique=True, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("declaration_items.id"))
    batch_id = Column(Integer)
    declaration_item_no = Column(String(50))
    certificate_type = Column(String(50))
    issue_date = Column(DateTime)
    tax_type = Column(String(50))
    tax_amount = Column(Float)
    currency = Column(String(10), default="CNY")
    reason = Column(Text)
    handler = Column(String(100))
    is_valid = Column(Boolean, default=True)
    source_type = Column(String(50))
    source_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(Text)

    item = relationship("DeclarationItem", back_populates="tax_certificates")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(Enum(OperationType), nullable=False)
    batch_id = Column(Integer, ForeignKey("declaration_batches.id"))
    item_id = Column(Integer, ForeignKey("declaration_items.id"))
    operator = Column(String(100), nullable=False)
    operation_time = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text)
    before_data = Column(Text)
    after_data = Column(Text)
    remark = Column(Text)

    batch = relationship("DeclarationBatch", back_populates="operations")
    item = relationship("DeclarationItem", back_populates="operations")
