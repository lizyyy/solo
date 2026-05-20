from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class BatchStatus(str, enum.Enum):
    CREATED = "created"
    PROCESSING = "processing"
    ARCHIVED = "archived"


class DataCategory(str, enum.Enum):
    NORMAL = "normal"
    PENDING_SUPPLEMENT = "pending_supplement"
    BLOCKED = "blocked"


class ProcessingAction(str, enum.Enum):
    AUTO_CLASSIFY = "auto_classify"
    MANUAL_REVIEW = "manual_review"
    SUPPLEMENT_DATA = "supplement_data"
    ARCHIVE = "archive"
    MODIFY_CONCLUSION = "modify_conclusion"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    billing_month = Column(String(7), nullable=False)
    status = Column(Enum(BatchStatus), default=BatchStatus.CREATED)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    archived_at = Column(DateTime(timezone=True))
    archived_by = Column(String(100))

    source_materials = relationship("SourceMaterial", back_populates="batch")
    electricity_details = relationship("ElectricityDetail", back_populates="batch")


class SourceMaterial(Base):
    __tablename__ = "source_materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_type = Column(String(50), nullable=False)
    file_name = Column(String(255))
    file_path = Column(String(500))
    content = Column(Text)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(String(500))

    batch = relationship("Batch", back_populates="source_materials")


class ElectricityDetail(Base):
    __tablename__ = "electricity_details"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    tenant_code = Column(String(50), index=True, nullable=False)
    tenant_name = Column(String(200), nullable=False)
    temperature_zone = Column(String(100), nullable=False)
    electricity_rate = Column(Float, nullable=False)
    meter_reading_start = Column(Float)
    meter_reading_end = Column(Float)
    basic_electricity = Column(Float)
    overtime_hours = Column(Float)
    overtime_electricity = Column(Float)
    manual_allocation = Column(Float, default=0.0)
    total_electricity = Column(Float)
    category = Column(Enum(DataCategory), default=DataCategory.NORMAL)
    category_reason = Column(String(500))
    is_archived = Column(Boolean, default=False)
    final_processor = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="electricity_details")
    processing_traces = relationship("ProcessingTrace", back_populates="detail")
    audit_logs = relationship("AuditLog", back_populates="detail")


class ProcessingTrace(Base):
    __tablename__ = "processing_traces"

    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(Integer, ForeignKey("electricity_details.id"), nullable=False)
    action = Column(Enum(ProcessingAction), nullable=False)
    operator = Column(String(100), nullable=False)
    operated_at = Column(DateTime(timezone=True), server_default=func.now())
    remark = Column(String(500))
    previous_category = Column(Enum(DataCategory))
    new_category = Column(Enum(DataCategory))

    detail = relationship("ElectricityDetail", back_populates="processing_traces")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(Integer, ForeignKey("electricity_details.id"), nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    modified_by = Column(String(100), nullable=False)
    modified_at = Column(DateTime(timezone=True), server_default=func.now())
    change_reason = Column(String(500), nullable=False)

    detail = relationship("ElectricityDetail", back_populates="audit_logs")
