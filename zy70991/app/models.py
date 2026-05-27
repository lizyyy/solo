from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum as SqlEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class BatchStatus(str, enum.Enum):
    CREATED = "created"
    MATERIALS_UPLOADED = "materials_uploaded"
    SPLITTING = "splitting"
    SPLIT_COMPLETED = "split_completed"
    REPORT_GENERATED = "report_generated"


class DetailType(str, enum.Enum):
    ELECTRICITY = "electricity"
    WATER = "water"
    DAMAGE = "damage"
    REFUND = "refund"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    operator = Column(String, nullable=False)
    property_id = Column(String, index=True, nullable=False)
    tenant_name = Column(String, nullable=False)
    deposit_amount = Column(Float, nullable=False)
    status = Column(SqlEnum(BatchStatus), default=BatchStatus.CREATED)
    material_fingerprint = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    materials = relationship("Material", back_populates="batch")
    settlement_details = relationship("SettlementDetail", back_populates="batch")
    reports = relationship("Report", back_populates="batch")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_type = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    file_name = Column(String)
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="materials")


class SettlementDetail(Base):
    __tablename__ = "settlement_details"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    detail_type = Column(SqlEnum(DetailType), nullable=False, index=True)
    reference_no = Column(String, unique=True, index=True, nullable=False)
    original_amount = Column(Float, nullable=False)
    calculated_amount = Column(Float, nullable=False)
    description = Column(Text)
    calc_details = Column(Text)
    status = Column(String, default="pending")
    is_adjusted = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="settlement_details")
    traces = relationship("ProcessingTrace", back_populates="detail")


class ProcessingTrace(Base):
    __tablename__ = "processing_traces"

    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(Integer, ForeignKey("settlement_details.id"), nullable=False)
    action = Column(String, nullable=False)
    operator = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    detail = relationship("SettlementDetail", back_populates="traces")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    report_no = Column(String, unique=True, index=True, nullable=False)
    total_electricity_fee = Column(Float, default=0.0)
    total_water_fee = Column(Float, default=0.0)
    total_damage_compensation = Column(Float, default=0.0)
    total_refund = Column(Float, default=0.0)
    total_settlement = Column(Float, nullable=False)
    deposit_refund = Column(Float, nullable=False)
    report_content = Column(Text)
    file_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="reports")
