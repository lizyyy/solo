from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class EvidenceStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    VERIFYING = "verifying"
    VERIFIED = "verified"
    SUPPLEMENT_REQUIRED = "supplement_required"
    EXCEPTION = "exception"
    MANUALLY_CORRECTED = "manually_corrected"
    COMPLETED = "completed"
    EXPORTED = "exported"


class EvidencePackage(Base):
    __tablename__ = "evidence_packages"

    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String, index=True, nullable=False)
    current_version = Column(Integer, default=1)
    status = Column(String, default=EvidenceStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String)
    latest_signature = Column(Text)
    verification_result = Column(Text)
    chain_report = Column(Text)

    materials = relationship("Material", back_populates="package", cascade="all, delete-orphan")
    signatures = relationship("Signature", back_populates="package", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="package", cascade="all, delete-orphan")
    supplement_notes = relationship("SupplementNote", back_populates="package", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("evidence_packages.id"))
    material_name = Column(String, nullable=False)
    material_type = Column(String)
    file_hash = Column(String, index=True)
    file_path = Column(String)
    version = Column(Integer, default=1)
    is_supplement = Column(Boolean, default=False)
    supplement_reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String)

    package = relationship("EvidencePackage", back_populates="materials")


class Signature(Base):
    __tablename__ = "signatures"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("evidence_packages.id"))
    version = Column(Integer, nullable=False)
    signature_value = Column(Text, nullable=False)
    signed_by = Column(String)
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    previous_signature_id = Column(Integer, ForeignKey("signatures.id"))
    verification_status = Column(String, default="pending")
    verification_details = Column(Text)
    materials_hash = Column(String)

    package = relationship("EvidencePackage", back_populates="signatures")
    previous_signature = relationship("Signature", remote_side=[id], uselist=False)


class SupplementNote(Base):
    __tablename__ = "supplement_notes"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("evidence_packages.id"))
    version = Column(Integer, nullable=False)
    note_content = Column(Text, nullable=False)
    created_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    related_material_ids = Column(JSON)

    package = relationship("EvidencePackage", back_populates="supplement_notes")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("evidence_packages.id"))
    operation_type = Column(String, nullable=False)
    operation_status = Column(String, nullable=False)
    operator = Column(String)
    operation_at = Column(DateTime(timezone=True), server_default=func.now())
    original_input = Column(Text)
    processing_basis = Column(Text)
    final_conclusion = Column(Text)
    error_message = Column(Text)
    details = Column(JSON)

    package = relationship("EvidencePackage", back_populates="operation_logs")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, index=True)
    case_number = Column(String, index=True)
    export_version = Column(Integer, nullable=False)
    export_at = Column(DateTime(timezone=True), server_default=func.now())
    exported_by = Column(String)
    export_fields = Column(JSON)
    export_signature = Column(Text)
    download_token = Column(String)
    download_expires_at = Column(DateTime(timezone=True))
    is_downloaded = Column(Boolean, default=False)
