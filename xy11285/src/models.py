import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship

from src.database import Base


class MedicineType(str, enum.Enum):
    INJECTION = "injection"
    ORAL = "oral"
    EXTERNAL = "external"
    OTHER = "other"


class PrescriptionStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISPENSED = "dispensed"
    CANCELLED = "cancelled"


class BatchOperationStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARTIAL_SUCCESS = "partial_success"
    SUCCESS = "success"
    FAILED = "failed"


class ErrorType(str, enum.Enum):
    VALIDATION_ERROR = "validation_error"
    DOSAGE_ERROR = "dosage_error"
    INVENTORY_ERROR = "inventory_error"
    BATCH_ERROR = "batch_error"
    SYSTEM_ERROR = "system_error"


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    generic_name = Column(String(200))
    type = Column(Enum(MedicineType), default=MedicineType.OTHER)
    manufacturer = Column(String(200))
    specification = Column(String(200))
    dosage_unit = Column(String(50))
    dosage_per_kg = Column(Float)
    max_dosage = Column(Float)
    min_dosage = Column(Float)
    concentration = Column(Float)
    concentration_unit = Column(String(50))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventory_batches = relationship("InventoryBatch", back_populates="medicine")
    prescription_items = relationship("PrescriptionItem", back_populates="medicine")


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    batch_number = Column(String(100), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    location = Column(String(100))
    supplier = Column(String(200))
    purchase_price = Column(Float)
    selling_price = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    medicine = relationship("Medicine", back_populates="inventory_batches")
    prescription_items = relationship("PrescriptionItem", back_populates="inventory_batch")


class Pet(Base):
    __tablename__ = "pets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    species = Column(String(100), nullable=False, index=True)
    breed = Column(String(100))
    age = Column(Float)
    weight = Column(Float, nullable=False)
    weight_unit = Column(String(20), default="kg")
    owner_name = Column(String(100))
    owner_phone = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prescriptions = relationship("Prescription", back_populates="pet")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    department = Column(String(100))
    phone = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescriptions = relationship("Prescription", back_populates="doctor")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    prescription_no = Column(String(50), unique=True, nullable=False, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    status = Column(Enum(PrescriptionStatus), default=PrescriptionStatus.DRAFT)
    diagnosis = Column(Text)
    notes = Column(Text)
    created_by = Column(String(100))
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    dispensed_by = Column(String(100))
    dispensed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    pet = relationship("Pet", back_populates="prescriptions")
    doctor = relationship("Doctor", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")
    operation_logs = relationship("PrescriptionOperationLog", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    inventory_batch_id = Column(Integer, ForeignKey("inventory_batches.id"))
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))
    calculated_dosage = Column(Float)
    dosage_notes = Column(Text)
    administration_route = Column(String(100))
    frequency = Column(String(100))
    duration = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="items")
    medicine = relationship("Medicine", back_populates="prescription_items")
    inventory_batch = relationship("InventoryBatch", back_populates="prescription_items")


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(String(100), unique=True, nullable=False, index=True)
    operation_type = Column(String(100), nullable=False, index=True)
    status = Column(Enum(BatchOperationStatus), default=BatchOperationStatus.PENDING)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_by = Column(String(100), index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("BatchOperationItem", back_populates="operation", cascade="all, delete-orphan")


class BatchOperationItem(Base):
    __tablename__ = "batch_operation_items"

    id = Column(Integer, primary_key=True, index=True)
    operation_id = Column(Integer, ForeignKey("batch_operations.id"), nullable=False)
    row_index = Column(Integer)
    row_data = Column(Text)
    status = Column(String(50), default="pending")
    error_type = Column(Enum(ErrorType))
    error_message = Column(Text)
    record_id = Column(Integer)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    operation = relationship("BatchOperation", back_populates="items")


class PrescriptionOperationLog(Base):
    __tablename__ = "prescription_operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    operation = Column(String(100), nullable=False)
    operator = Column(String(100), nullable=False)
    old_status = Column(String(50))
    new_status = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="operation_logs")
