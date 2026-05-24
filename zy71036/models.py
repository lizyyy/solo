from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class ScaffoldStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    AUTO_PASSED = "auto_passed"
    AUTO_REJECTED = "auto_rejected"
    PENDING_MANUAL = "pending_manual"
    MANUAL_APPROVED = "manual_approved"
    MANUAL_REJECTED = "manual_rejected"
    RETURNED = "returned"
    RESUBMITTED = "resubmitted"
    DEACTIVATED = "deactivated"
    ACTIVE = "active"
    UNDER_RECTIFICATION = "under_rectification"
    RECTIFIED = "rectified"


class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text)
    is_deactivated = Column(Boolean, default=False)
    deactivated_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    scaffolds = relationship("Scaffold", back_populates="area")


class Scaffold(Base):
    __tablename__ = "scaffolds"

    id = Column(Integer, primary_key=True, index=True)
    scaffold_number = Column(String(50), unique=True, index=True, nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    type = Column(String(50))
    height = Column(Float)
    specification = Column(Text)
    is_deactivated = Column(Boolean, default=False)
    deactivated_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    area = relationship("Area", back_populates="scaffolds")
    acceptance_records = relationship("AcceptanceRecord", back_populates="scaffold")
    rectifications = relationship("Rectification", back_populates="scaffold")


class AcceptanceRecord(Base):
    __tablename__ = "acceptance_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), index=True, nullable=False)
    scaffold_id = Column(Integer, ForeignKey("scaffolds.id"), nullable=False)
    status = Column(String(50), default=ScaffoldStatus.DRAFT.value)
    inspector = Column(String(100))
    inspection_date = Column(DateTime(timezone=True))
    acceptance_date = Column(DateTime(timezone=True))
    is_accepted = Column(Boolean, default=False)
    rejection_reason = Column(Text)
    version = Column(Integer, default=1)
    submission_count = Column(Integer, default=0)
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    manual_override_by = Column(String(100))
    manual_override_reason = Column(Text)
    manual_override_at = Column(DateTime(timezone=True))

    scaffold = relationship("Scaffold", back_populates="acceptance_records")
    photos = relationship("Photo", back_populates="acceptance_record")
    rectifications = relationship("Rectification", back_populates="acceptance_record")
    operation_logs = relationship("OperationLog", back_populates="acceptance_record")
    report = relationship("AcceptanceReport", uselist=False, back_populates="acceptance_record")


class Rectification(Base):
    __tablename__ = "rectifications"

    id = Column(Integer, primary_key=True, index=True)
    acceptance_record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    scaffold_id = Column(Integer, ForeignKey("scaffolds.id"), nullable=False)
    item_no = Column(String(50))
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="normal")
    is_closed = Column(Boolean, default=False)
    closed_at = Column(DateTime(timezone=True))
    closed_by = Column(String(100))
    verification_method = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    acceptance_record = relationship("AcceptanceRecord", back_populates="rectifications")
    scaffold = relationship("Scaffold", back_populates="rectifications")
    photos = relationship("Photo", back_populates="rectification")


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    acceptance_record_id = Column(Integer, ForeignKey("acceptance_records.id"))
    rectification_id = Column(Integer, ForeignKey("rectifications.id"))
    file_path = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=False)
    photo_type = Column(String(50))
    description = Column(Text)
    uploaded_by = Column(String(100))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    acceptance_record = relationship("AcceptanceRecord", back_populates="photos")
    rectification = relationship("Rectification", back_populates="photos")


class AcceptanceReport(Base):
    __tablename__ = "acceptance_reports"

    id = Column(Integer, primary_key=True, index=True)
    acceptance_record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    report_no = Column(String(50), unique=True, nullable=False)
    file_path = Column(String(255), nullable=False)
    generated_by = Column(String(100))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    signature = Column(String(255))

    acceptance_record = relationship("AcceptanceRecord", back_populates="report")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    acceptance_record_id = Column(Integer, ForeignKey("acceptance_records.id"), nullable=False)
    operation = Column(String(50), nullable=False)
    previous_status = Column(String(50))
    new_status = Column(String(50))
    operator = Column(String(100))
    reason = Column(Text)
    operation_time = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(50))

    acceptance_record = relationship("AcceptanceRecord", back_populates="operation_logs")
