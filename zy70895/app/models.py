from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class MaterialStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    REJECTED = "rejected"


class ChangeType(str, enum.Enum):
    CONCLUSION_CHANGE = "conclusion_change"
    STATUS_CHANGE = "status_change"
    REASSIGNMENT = "reassignment"
    OTHER = "other"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True, nullable=False)
    product_model = Column(String, nullable=False)
    production_line = Column(String)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    description = Column(Text)

    materials = relationship("Material", back_populates="batch")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    material_hash = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    work_order = Column(String, index=True, nullable=False)
    workstation = Column(String, index=True)
    material_batch = Column(String, index=True)
    rework_reason = Column(String)
    status = Column(String, default=MaterialStatus.PENDING)
    conclusion = Column(Text)
    handler = Column(String)
    final_processor = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    raw_data = Column(Text)

    batch = relationship("Batch", back_populates="materials")
    audit_logs = relationship("AuditLog", back_populates="material")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))
    change_type = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    change_reason = Column(Text, nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    material = relationship("Material", back_populates="audit_logs")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"))
    reviewer = Column(String, nullable=False)
    review_comment = Column(Text)
    review_result = Column(String)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())
