from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    APPROVED = "approved"
    RETURNED = "returned"
    NEEDS_MORE_INFO = "needs_more_info"


class ExceptionType(str, Enum):
    OVERDUE = "overdue"
    MULTIPLE_CONTRACTS = "multiple_contracts"
    MISSING_PHOTO = "missing_photo"
    NO_CONTRACT = "no_contract"


class ActionType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    APPROVE = "approve"
    RETURN = "return"
    REQUEST_INFO = "request_info"
    EXPORT = "export"


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    description = Column(Text)
    total_records = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)

    records = relationship("MaintenanceRecord", back_populates="batch")
    audit_logs = relationship("AuditLog", back_populates="batch")


class Equipment(Base):
    __tablename__ = "equipments"

    id = Column(Integer, primary_key=True, index=True)
    equipment_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    type = Column(String(100))
    floor = Column(String(50))
    area = Column(String(100))
    location = Column(String(200))
    installation_date = Column(Date)
    maintenance_person = Column(String(100))
    last_inspection_date = Column(Date)
    next_inspection_date = Column(Date)
    status = Column(String(50), default="normal")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contracts = relationship("Contract", back_populates="equipment")
    photos = relationship("InspectionPhoto", back_populates="equipment")


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    contract_number = Column(String(100), unique=True, index=True, nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    equipment_code = Column(String(100), index=True)
    vendor_name = Column(String(200))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    contract_amount = Column(Integer)
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    status = Column(String(50), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    equipment = relationship("Equipment", back_populates="contracts")


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id = Column(Integer, primary_key=True, index=True)
    photo_code = Column(String(100), unique=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    equipment_code = Column(String(100), index=True)
    file_name = Column(String(255))
    file_path = Column(String(500))
    inspection_date = Column(Date)
    photographer = Column(String(100))
    description = Column(Text)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    equipment = relationship("Equipment", back_populates="photos")


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, index=True)
    record_number = Column(String(100), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    equipment_id = Column(Integer, ForeignKey("equipments.id"))
    equipment_code = Column(String(100), index=True)
    equipment_name = Column(String(200))
    floor = Column(String(50))
    area = Column(String(100))
    maintenance_person = Column(String(100))
    inspection_date = Column(Date)
    next_inspection_date = Column(Date)
    status = Column(String(50), default=RecordStatus.PENDING)
    has_exception = Column(Boolean, default=False)
    exception_types = Column(String(500))
    exception_reason = Column(Text)
    readable_explanation = Column(Text)
    handled_by = Column(String(100))
    handled_at = Column(DateTime(timezone=True))
    handler_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="records")
    exceptions = relationship("RecordException", back_populates="record")
    audit_logs = relationship("AuditLog", back_populates="record")


class RecordException(Base):
    __tablename__ = "record_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("maintenance_records.id"))
    exception_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    record = relationship("MaintenanceRecord", back_populates="exceptions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_id = Column(Integer, ForeignKey("maintenance_records.id"))
    action_type = Column(String(50), nullable=False)
    action_by = Column(String(100), nullable=False)
    action_at = Column(DateTime(timezone=True), server_default=func.now())
    from_status = Column(String(50))
    to_status = Column(String(50))
    reason = Column(Text)
    notes = Column(Text)
    ip_address = Column(String(50))

    batch = relationship("Batch", back_populates="audit_logs")
    record = relationship("MaintenanceRecord", back_populates="audit_logs")
