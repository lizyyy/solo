from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RECEIVED = "received"
    INSPECTED = "inspected"
    COMPLETED = "completed"
    REJECTED = "rejected"


class AnomalyType(str, enum.Enum):
    TEMPERATURE_HIGH = "temperature_high"
    TEMPERATURE_LOW = "temperature_low"
    PACKAGE_DAMAGED = "package_damaged"
    MISSING_ITEMS = "missing_items"
    EXPIRED = "expired"
    WRONG_PRODUCT = "wrong_product"
    DOCUMENTATION_MISSING = "documentation_missing"
    OTHER = "other"


class ImportRecordStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    supplier_name = Column(String, nullable=False)
    delivery_date = Column(DateTime, nullable=False)
    received_by = Column(String)
    received_at = Column(DateTime)
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    total_items = Column(Integer, default=0)
    anomaly_count = Column(Integer, default=0)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship("DeliveryItem", back_populates="delivery_order", cascade="all, delete-orphan")
    temperature_records = relationship("TemperatureRecord", back_populates="delivery_order", cascade="all, delete-orphan")
    photos = relationship("DeliveryPhoto", back_populates="delivery_order", cascade="all, delete-orphan")
    anomalies = relationship("AnomalyRecord", back_populates="delivery_order", cascade="all, delete-orphan")


class DeliveryItem(Base):
    __tablename__ = "delivery_items"

    id = Column(Integer, primary_key=True, index=True)
    delivery_order_id = Column(Integer, ForeignKey("delivery_orders.id"), nullable=False)
    product_code = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    batch_number = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit = Column(String, default="盒")
    manufacture_date = Column(DateTime)
    expiry_date = Column(DateTime, nullable=False)
    storage_condition = Column(String)
    min_temperature = Column(Float)
    max_temperature = Column(Float)
    is_inspected = Column(Boolean, default=False)
    inspected_by = Column(String)
    inspected_at = Column(DateTime)
    inspection_result = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    delivery_order = relationship("DeliveryOrder", back_populates="items")


class TemperatureRecord(Base):
    __tablename__ = "temperature_records"

    id = Column(Integer, primary_key=True, index=True)
    delivery_order_id = Column(Integer, ForeignKey("delivery_orders.id"), nullable=False)
    record_time = Column(DateTime, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float)
    device_id = Column(String)
    location = Column(String)
    is_anomaly = Column(Boolean, default=False)
    anomaly_type = Column(Enum(AnomalyType))
    remarks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    delivery_order = relationship("DeliveryOrder", back_populates="temperature_records")


class DeliveryPhoto(Base):
    __tablename__ = "delivery_photos"

    id = Column(Integer, primary_key=True, index=True)
    delivery_order_id = Column(Integer, ForeignKey("delivery_orders.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer)
    photo_type = Column(String)
    uploaded_by = Column(String)
    uploaded_at = Column(DateTime, server_default=func.now())
    description = Column(Text)
    is_anomaly_evidence = Column(Boolean, default=False)
    anomaly_id = Column(Integer, ForeignKey("anomaly_records.id"))

    delivery_order = relationship("DeliveryOrder", back_populates="photos")
    anomaly = relationship("AnomalyRecord", back_populates="photos")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"

    id = Column(Integer, primary_key=True, index=True)
    delivery_order_id = Column(Integer, ForeignKey("delivery_orders.id"), nullable=False)
    anomaly_type = Column(Enum(AnomalyType), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String, default="medium")
    reported_by = Column(String)
    reported_at = Column(DateTime, server_default=func.now())
    status = Column(String, default="open")
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    resolution = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    delivery_order = relationship("DeliveryOrder", back_populates="anomalies")
    photos = relationship("DeliveryPhoto", back_populates="anomaly")


class BadImportRecord(Base):
    __tablename__ = "bad_import_records"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, nullable=False, index=True)
    import_type = Column(String, nullable=False)
    original_position = Column(String, nullable=False)
    raw_data = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)
    suggested_fix = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(String, primary_key=True, index=True)
    import_type = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(Enum(ImportRecordStatus), default=ImportRecordStatus.PENDING)
    started_by = Column(String)
    started_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime)
    remarks = Column(Text)
