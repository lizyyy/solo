import enum
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, Enum, Boolean,
)
from sqlalchemy.orm import relationship

from app.database import Base


class AppealStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    REVIEW = "review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"


class MaterialStatus(str, enum.Enum):
    MISSING = "missing"
    UPLOADED = "uploaded"
    VERIFIED = "verified"
    REJECTED = "rejected"


class FlagType(str, enum.Enum):
    RULE_VERSION_MISMATCH = "rule_version_mismatch"
    MATERIAL_MISSING = "material_missing"
    DUPLICATE_APPEAL = "duplicate_appeal"
    DATA_INCONSISTENCY = "data_inconsistency"


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    appeal_no = Column(String(64), unique=True, nullable=False, index=True)
    patient_name = Column(String(128), nullable=False)
    admission_no = Column(String(64), index=True)
    insurance_no = Column(String(64))
    status = Column(Enum(AppealStatus), default=AppealStatus.DRAFT, nullable=False)
    operator = Column(String(64))
    reviewer = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medical_record = relationship("MedicalRecord", back_populates="appeal", uselist=False, cascade="all,delete-orphan")
    deductions = relationship("Deduction", back_populates="appeal", cascade="all,delete-orphan")
    materials = relationship("Material", back_populates="appeal", cascade="all,delete-orphan")
    rule_matches = relationship("RuleMatch", back_populates="appeal", cascade="all,delete-orphan")
    processing = relationship("Processing", back_populates="appeal", uselist=False, cascade="all,delete-orphan")
    review = relationship("Review", back_populates="appeal", uselist=False, cascade="all,delete-orphan")
    flags = relationship("Flag", back_populates="appeal", cascade="all,delete-orphan")
    change_history = relationship("ChangeHistory", back_populates="appeal", cascade="all,delete-orphan")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False, unique=True)
    diagnosis_code = Column(String(32))
    diagnosis_name = Column(String(256))
    admission_date = Column(String(32))
    discharge_date = Column(String(32))
    department = Column(String(128))
    attending_doctor = Column(String(64))
    summary = Column(Text)

    appeal = relationship("Appeal", back_populates="medical_record")


class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    item_code = Column(String(64))
    item_name = Column(String(256))
    deduction_amount = Column(Float, default=0.0)
    reason_code = Column(String(64))
    reason_text = Column(String(512))
    rule_version = Column(String(32))
    is_disputed = Column(Boolean, default=True)

    appeal = relationship("Appeal", back_populates="deductions")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    category = Column(String(64), nullable=False)
    file_name = Column(String(256))
    description = Column(Text)
    status = Column(Enum(MaterialStatus), default=MaterialStatus.MISSING, nullable=False)
    uploaded_at = Column(DateTime)
    verified_at = Column(DateTime)

    appeal = relationship("Appeal", back_populates="materials")


class RuleMatch(Base):
    __tablename__ = "rule_matches"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    deduction_id = Column(Integer, ForeignKey("deductions.id"))
    rule_code = Column(String(64))
    rule_name = Column(String(256))
    rule_version = Column(String(32))
    is_version_latest = Column(Boolean, default=True)
    match_result = Column(String(32))
    explanation = Column(Text)

    appeal = relationship("Appeal", back_populates="rule_matches")


class Processing(Base):
    __tablename__ = "processings"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False, unique=True)
    material_check_passed = Column(Boolean, default=False)
    material_check_note = Column(Text)
    rule_check_passed = Column(Boolean, default=False)
    rule_check_note = Column(Text)
    progress_note = Column(Text)
    difference_explanation = Column(Text)
    processed_at = Column(DateTime, default=datetime.utcnow)
    processed_by = Column(String(64))

    appeal = relationship("Appeal", back_populates="processing")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False, unique=True)
    result = Column(String(32))
    comment = Column(Text)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by = Column(String(64))

    appeal = relationship("Appeal", back_populates="review")


class Flag(Base):
    __tablename__ = "flags"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    flag_type = Column(Enum(FlagType), nullable=False)
    detail = Column(Text)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)

    appeal = relationship("Appeal", back_populates="flags")


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    field_name = Column(String(128), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(64))
    changed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)

    appeal = relationship("Appeal", back_populates="change_history")
