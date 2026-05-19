from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class ReagentHazardLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EXTREME = "extreme"


class RecordStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISPENSED = "dispensed"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class ExceptionType(str, enum.Enum):
    NONE = "none"
    INSUFFICIENT_STOCK = "insufficient_stock"
    HAZARD_APPROVAL_REQUIRED = "hazard_approval_required"
    INVALID_RECIPIENT = "invalid_recipient"
    EXPIRED_REAGENT = "expired_reagent"
    DUPLICATE_RECORD = "duplicate_record"
    SYSTEM_ERROR = "system_error"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    employee_id = Column(String(50), unique=True, index=True, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    department = Column(String(100))
    phone = Column(String(20))
    email = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    created_records = relationship("ReagentRecord", foreign_keys="ReagentRecord.created_by_id", back_populates="creator")
    approved_records = relationship("ReagentRecord", foreign_keys="ReagentRecord.approved_by_id", back_populates="approver")


class Reagent(Base):
    __tablename__ = "reagents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    cas_number = Column(String(50), index=True)
    specification = Column(String(100))
    hazard_level = Column(Enum(ReagentHazardLevel), nullable=False)
    total_stock = Column(Float, nullable=False, default=0.0)
    available_stock = Column(Float, nullable=False, default=0.0)
    unit = Column(String(20), nullable=False)
    manufacturer = Column(String(200))
    batch_number = Column(String(100))
    expiry_date = Column(DateTime(timezone=True))
    location = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    records = relationship("ReagentRecord", back_populates="reagent")


class ReagentRecord(Base):
    __tablename__ = "reagent_records"

    id = Column(Integer, primary_key=True, index=True)
    reagent_id = Column(Integer, ForeignKey("reagents.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(RecordStatus), nullable=False, default=RecordStatus.PENDING)
    exception_type = Column(Enum(ExceptionType), nullable=False, default=ExceptionType.NONE)
    exception_message = Column(Text)
    purpose = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    dispensed_at = Column(DateTime(timezone=True))
    returned_at = Column(DateTime(timezone=True))
    batch_id = Column(String(100), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reagent = relationship("Reagent", back_populates="records")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_records")
    approver = relationship("User", foreign_keys=[approved_by_id], back_populates="approved_records")
    recipient = relationship("User", foreign_keys=[recipient_id])


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    operation_type = Column(String(50), nullable=False)
    total_count = Column(Integer, nullable=False)
    success_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="processing")
    error_summary = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
