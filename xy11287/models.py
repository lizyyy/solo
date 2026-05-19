from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RoleEnum(str, enum.Enum):
    DOCTOR = "doctor"
    PHARMACIST = "pharmacist"
    AUDITOR = "auditor"


class PrescriptionStatusEnum(str, enum.Enum):
    SUBMITTED = "submitted"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISPENSED = "dispensed"
    BLOCKED = "blocked"


class ExceptionTypeEnum(str, enum.Enum):
    DOSE_TOO_LOW = "dose_too_low"
    DOSE_TOO_HIGH = "dose_too_high"
    DRUG_CONTRAINDICATION = "drug_contraindication"
    BATCH_EXPIRED = "batch_expired"
    INSUFFICIENT_STOCK = "insufficient_stock"
    WEIGHT_MISMATCH = "weight_mismatch"


class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    generic_name = Column(String(100))
    manufacturer = Column(String(100))
    unit = Column(String(20), nullable=False)
    min_dose_per_kg = Column(Float, nullable=False)
    max_dose_per_kg = Column(Float, nullable=False)
    dose_unit = Column(String(20), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)

    inventory_batches = relationship("InventoryBatch", back_populates="drug")
    contraindications = relationship(
        "Contraindication",
        primaryjoin="or_(Drug.id == Contraindication.drug_a_id, Drug.id == Contraindication.drug_b_id)",
        viewonly=True
    )


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id = Column(Integer, primary_key=True, index=True)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    batch_number = Column(String(50), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    expiration_date = Column(DateTime, nullable=False)
    manufacturing_date = Column(DateTime)
    supplier = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50), nullable=False)

    drug = relationship("Drug", back_populates="inventory_batches")


class Contraindication(Base):
    __tablename__ = "contraindications"

    id = Column(Integer, primary_key=True, index=True)
    drug_a_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    drug_b_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(50), nullable=False)


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    prescription_no = Column(String(50), unique=True, nullable=False, index=True)
    patient_name = Column(String(100), nullable=False)
    species = Column(String(50), nullable=False)
    weight = Column(Float, nullable=False)
    weight_unit = Column(String(10), default="kg")
    age = Column(String(50))
    doctor = Column(String(50), nullable=False)
    status = Column(Enum(PrescriptionStatusEnum), default=PrescriptionStatusEnum.SUBMITTED)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(50), nullable=False)
    updated_by = Column(String(50))
    notes = Column(Text)

    items = relationship("PrescriptionItem", back_populates="prescription")
    audit_logs = relationship("AuditLog", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    drug_name = Column(String(100), nullable=False)
    batch_id = Column(Integer, ForeignKey("inventory_batches.id"))
    batch_number = Column(String(50))
    prescribed_dose = Column(Float, nullable=False)
    dose_unit = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    quantity_unit = Column(String(20), nullable=False)
    frequency = Column(String(100))
    duration = Column(String(100))
    route = Column(String(50))
    calculated_min_dose = Column(Float)
    calculated_max_dose = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prescription = relationship("Prescription", back_populates="items")
    validations = relationship("ValidationResult", back_populates="prescription_item")


class ValidationResult(Base):
    __tablename__ = "validation_results"

    id = Column(Integer, primary_key=True, index=True)
    prescription_item_id = Column(Integer, ForeignKey("prescription_items.id"), nullable=False)
    exception_type = Column(Enum(ExceptionTypeEnum), nullable=False)
    severity = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    is_blocking = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prescription_item = relationship("PrescriptionItem", back_populates="validations")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    action = Column(String(50), nullable=False)
    previous_status = Column(Enum(PrescriptionStatusEnum))
    new_status = Column(Enum(PrescriptionStatusEnum))
    operator = Column(String(50), nullable=False)
    operator_role = Column(Enum(RoleEnum), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prescription = relationship("Prescription", back_populates="audit_logs")


class DispenseRecord(Base):
    __tablename__ = "dispense_records"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    prescription_item_id = Column(Integer, ForeignKey("prescription_items.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("inventory_batches.id"), nullable=False)
    quantity_dispensed = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    dispensed_by = Column(String(50), nullable=False)
    dispensed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    request_type = Column(String(50), nullable=False)
    response_data = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
