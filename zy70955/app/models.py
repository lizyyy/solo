from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    submitter = Column(String(128), nullable=False)
    department = Column(String(128), default="展陈部")
    source_type = Column(String(32), default="manual")
    status = Column(String(32), default="created")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    materials = relationship("RawMaterial", back_populates="batch", cascade="all, delete-orphan")


class RawMaterial(Base):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    line_no = Column(Integer, nullable=False)
    artifact_no = Column(String(64), nullable=True)
    artifact_name = Column(String(256), nullable=True)
    borrower = Column(String(256), nullable=True)
    lender = Column(String(256), nullable=True)
    loan_start = Column(String(32), nullable=True)
    loan_end = Column(String(32), nullable=True)
    insurance_value = Column(String(64), nullable=True)
    insurance_type = Column(String(128), nullable=True)
    condition = Column(String(128), nullable=True)
    location = Column(String(256), nullable=True)
    remark = Column(Text, nullable=True)
    raw_payload = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("Batch", back_populates="materials")
    detail = relationship("ProcessingDetail", back_populates="material", uselist=False)

    __table_args__ = (
        Index("ix_batch_line", "batch_id", "line_no", unique=True),
    )


class ProcessingDetail(Base):
    __tablename__ = "processing_details"

    id = Column(Integer, primary_key=True, index=True)
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"), unique=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    category = Column(String(32), nullable=False)
    reason_code = Column(String(64), nullable=False)
    reason_detail = Column(Text, nullable=True)
    next_action = Column(String(128), nullable=True)
    review_status = Column(String(32), default="pending")
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    report_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    material = relationship("RawMaterial", back_populates="detail")
    trajectories = relationship("Trajectory", back_populates="detail", cascade="all, delete-orphan")


class Trajectory(Base):
    __tablename__ = "trajectories"

    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(Integer, ForeignKey("processing_details.id"), nullable=False)
    stage = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    operator = Column(String(128), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    detail = relationship("ProcessingDetail", back_populates="trajectories")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(Integer, ForeignKey("processing_details.id"), nullable=False)
    field_name = Column(String(128), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    changed_by = Column(String(128), nullable=False)
    reason = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
