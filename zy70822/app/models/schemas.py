from enum import Enum
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class RecordStatus(str, Enum):
    PENDING = "pending"
    AUTO_APPROVED = "auto_approved"
    AUTO_REJECTED = "auto_rejected"
    NEEDS_REVIEW = "needs_review"
    MANUALLY_APPROVED = "manually_approved"
    MANUALLY_REJECTED = "manually_rejected"
    NEEDS_MORE_INFO = "needs_more_info"


class DiscrepancyType(str, Enum):
    NO_INVENTORY = "no_inventory"
    LOW_STOCK = "low_stock"
    CONTRAINDICATION = "contraindication"
    DUPLICATE_RESCHEDULE = "duplicate_reschedule"
    AGE_INAPPROPRIATE = "age_inappropriate"
    OVERDUE = "overdue"
    INVALID_DATA = "invalid_data"


class ReviewAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_INFO = "request_info"
    MARK_AS_RESOLVED = "mark_resolved"


class Discrepancy(BaseModel):
    type: DiscrepancyType
    description: str
    severity: str = "warning"
    related_field: Optional[str] = None
    suggested_action: Optional[str] = None


class AppointmentDB(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(String, unique=True, index=True)
    child_name = Column(String)
    child_id_card = Column(String, index=True)
    birth_date = Column(Date)
    vaccine_name = Column(String)
    vaccine_batch = Column(String)
    appointment_date = Column(Date)
    appointment_time = Column(String)
    status = Column(String, default="scheduled")
    is_reschedule = Column(Boolean, default=False)
    original_appointment_id = Column(String, nullable=True)
    reschedule_count = Column(Integer, default=0)
    contact_phone = Column(String)
    address = Column(String)
    guardian_name = Column(String)
    remarks = Column(Text, nullable=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    batch_id = Column(String, index=True)

    reconciliation_records = relationship("ReconciliationRecordDB", back_populates="appointment")


class VaccineInventoryDB(Base):
    __tablename__ = "vaccine_inventory"

    id = Column(Integer, primary_key=True, index=True)
    vaccine_name = Column(String, index=True)
    vaccine_batch = Column(String, index=True)
    manufacturer = Column(String)
    production_date = Column(Date)
    expiration_date = Column(Date)
    total_quantity = Column(Integer)
    used_quantity = Column(Integer, default=0)
    reserved_quantity = Column(Integer, default=0)
    available_quantity = Column(Integer)
    min_stock_level = Column(Integer, default=10)
    location = Column(String)
    imported_at = Column(DateTime, default=datetime.utcnow)
    batch_id = Column(String, index=True)


class ContraindicationRuleDB(Base):
    __tablename__ = "contraindication_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String, unique=True)
    vaccine_name = Column(String)
    rule_type = Column(String)
    condition = Column(JSON)
    description = Column(String)
    severity = Column(String, default="high")
    action = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReconciliationRecordDB(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String, unique=True, index=True)
    appointment_id = Column(String, ForeignKey("appointments.appointment_id"))
    reconciliation_batch_id = Column(String, index=True)
    status = Column(String, default=RecordStatus.PENDING.value)
    discrepancies = Column(JSON, default=list)
    auto_check_passed = Column(Boolean, default=False)
    review_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    final_decision = Column(String, nullable=True)
    decision_reason = Column(Text, nullable=True)
    calculated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    trace_path = Column(JSON, default=list)

    appointment = relationship("AppointmentDB", back_populates="reconciliation_records")
    audit_logs = relationship("AuditLogDB", back_populates="reconciliation_record")


class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True)
    reconciliation_record_id = Column(String, ForeignKey("reconciliation_records.record_id"))
    action = Column(String)
    previous_state = Column(JSON)
    new_state = Column(JSON)
    changed_by = Column(String)
    change_reason = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String, nullable=True)

    reconciliation_record = relationship("ReconciliationRecordDB", back_populates="audit_logs")


class Appointment(BaseModel):
    appointment_id: str
    child_name: str
    child_id_card: str
    birth_date: date
    vaccine_name: str
    vaccine_batch: str
    appointment_date: date
    appointment_time: str
    status: str = "scheduled"
    is_reschedule: bool = False
    original_appointment_id: Optional[str] = None
    reschedule_count: int = 0
    contact_phone: str
    address: str
    guardian_name: str
    remarks: Optional[str] = None

    class Config:
        orm_mode = True


class VaccineInventory(BaseModel):
    vaccine_name: str
    vaccine_batch: str
    manufacturer: str
    production_date: date
    expiration_date: date
    total_quantity: int
    used_quantity: int = 0
    reserved_quantity: int = 0
    available_quantity: int
    min_stock_level: int = 10
    location: str

    class Config:
        orm_mode = True


class ContraindicationRule(BaseModel):
    rule_id: str
    vaccine_name: str
    rule_type: str
    condition: Dict[str, Any]
    description: str
    severity: str = "high"
    action: str
    is_active: bool = True

    class Config:
        orm_mode = True


class ReconciliationRecord(BaseModel):
    record_id: str
    appointment_id: str
    reconciliation_batch_id: str
    status: RecordStatus = RecordStatus.PENDING
    discrepancies: List[Discrepancy] = Field(default_factory=list)
    auto_check_passed: bool = False
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    final_decision: Optional[str] = None
    decision_reason: Optional[str] = None
    calculated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    trace_path: List[str] = Field(default_factory=list)

    class Config:
        orm_mode = True


class AuditLog(BaseModel):
    log_id: str
    reconciliation_record_id: str
    action: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    changed_by: str
    change_reason: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None

    class Config:
        orm_mode = True


class ReconciliationResult(BaseModel):
    batch_id: str
    total_records: int
    auto_approved: int
    auto_rejected: int
    needs_review: int
    manually_processed: int
    discrepancies_found: int
    processed_at: datetime
    status: str


class ReportSummary(BaseModel):
    batch_id: str
    generated_at: datetime
    summary: Dict[str, Any]
    details: List[Dict[str, Any]]
