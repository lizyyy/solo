from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    CONFLICT = "conflict"


class ConflictStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class ConfirmationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String, unique=True, index=True, nullable=False)
    supplier_name = Column(String, nullable=False)
    contact_info = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    products = relationship("SupplierProduct", back_populates="supplier")
    sync_batches = relationship("SyncBatch", back_populates="supplier")


class SupplierProduct(Base):
    __tablename__ = "supplier_products"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    supplier_sku = Column(String, index=True, nullable=False)
    product_name = Column(String)
    raw_data = Column(JSON)
    field_version = Column(Integer, default=1)
    is_dirty = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    supplier = relationship("Supplier", back_populates="products")
    mappings = relationship("ProductMapping", back_populates="supplier_product")
    conflicts = relationship("ConflictItem", back_populates="supplier_product")


class InternalCatalog(Base):
    __tablename__ = "internal_catalogs"

    id = Column(Integer, primary_key=True, index=True)
    internal_sku = Column(String, unique=True, index=True, nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String)
    brand = Column(String)
    specs = Column(JSON)
    price = Column(Float)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    mappings = relationship("ProductMapping", back_populates="internal_product")


class MappingRule(Base):
    __tablename__ = "mapping_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, nullable=False)
    version = Column(Integer, default=1)
    field_mappings = Column(JSON)
    transformation_rules = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String)


class ProductMapping(Base):
    __tablename__ = "product_mappings"

    id = Column(Integer, primary_key=True, index=True)
    supplier_product_id = Column(Integer, ForeignKey("supplier_products.id"))
    internal_product_id = Column(Integer, ForeignKey("internal_catalogs.id"))
    mapping_rule_id = Column(Integer, ForeignKey("mapping_rules.id"))
    confidence_score = Column(Float)
    is_manual = Column(Boolean, default=False)
    mapped_fields = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    supplier_product = relationship("SupplierProduct", back_populates="mappings")
    internal_product = relationship("InternalCatalog", back_populates="mappings")
    timeline = relationship("MappingTimeline", back_populates="mapping")


class MappingTimeline(Base):
    __tablename__ = "mapping_timeline"

    id = Column(Integer, primary_key=True, index=True)
    mapping_id = Column(Integer, ForeignKey("product_mappings.id"))
    action = Column(String, nullable=False)
    action_details = Column(JSON)
    performed_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mapping = relationship("ProductMapping", back_populates="timeline")


class SyncBatch(Base):
    __tablename__ = "sync_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    status = Column(String, default=SyncStatus.PENDING)
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    success_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    conflict_items = Column(Integer, default=0)
    idempotency_key = Column(String, unique=True, index=True)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", back_populates="sync_batches")
    conflicts = relationship("ConflictItem", back_populates="batch")
    pending_values = relationship("PendingConfirmation", back_populates="batch")


class ConflictItem(Base):
    __tablename__ = "conflict_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sync_batches.id"))
    supplier_product_id = Column(Integer, ForeignKey("supplier_products.id"))
    conflict_type = Column(String)
    field_name = Column(String)
    old_value = Column(JSON)
    new_value = Column(JSON)
    status = Column(String, default=ConflictStatus.OPEN)
    resolution = Column(JSON)
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("SyncBatch", back_populates="conflicts")
    supplier_product = relationship("SupplierProduct", back_populates="conflicts")


class PendingConfirmation(Base):
    __tablename__ = "pending_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("sync_batches.id"))
    supplier_product_id = Column(Integer)
    field_name = Column(String)
    suggested_value = Column(JSON)
    current_value = Column(JSON)
    status = Column(String, default=ConfirmationStatus.PENDING)
    confirmed_value = Column(JSON)
    confirmed_by = Column(String)
    confirmed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("SyncBatch", back_populates="pending_values")


class CompensationLog(Base):
    __tablename__ = "compensation_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String)
    action = Column(String)
    details = Column(JSON)
    status = Column(String)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
