from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.database import Base


class RepairStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    OUTSOURCED = "outsourced"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class UrgencyLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EMERGENCY = "emergency"


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    building_name = Column(String(100), nullable=False)
    unit_number = Column(String(50), nullable=False)
    room_number = Column(String(50), nullable=False)
    owner_name = Column(String(100))
    owner_phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.now)

    repairs = relationship("RepairOrder", back_populates="building")


class Handler(Base):
    __tablename__ = "handlers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    department = Column(String(100))
    is_outsourcer = Column(Boolean, default=False)
    company_name = Column(String(200))
    skills = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    is_active = Column(Boolean, default=True)

    assigned_repairs = relationship("RepairOrder", back_populates="handler")
    outsourcing_records = relationship("OutsourcingRecord", back_populates="outsourcer")


class RepairOrder(Base):
    __tablename__ = "repair_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"))
    reporter_name = Column(String(100))
    reporter_phone = Column(String(20))
    repair_type = Column(String(100))
    description = Column(Text)
    urgency = Column(Enum(UrgencyLevel), default=UrgencyLevel.MEDIUM)
    status = Column(Enum(RepairStatus), default=RepairStatus.PENDING)
    handler_id = Column(Integer, ForeignKey("handlers.id"))
    reported_at = Column(DateTime(timezone=True), default=datetime.now)
    expected_completion_time = Column(DateTime(timezone=True))
    actual_completion_time = Column(DateTime(timezone=True))
    is_overdue = Column(Boolean, default=False)
    is_duplicate = Column(Boolean, default=False)
    merged_into_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), onupdate=datetime.now)

    building = relationship("Building", back_populates="repairs")
    handler = relationship("Handler", back_populates="assigned_repairs")
    reminders = relationship("ReminderRecord", back_populates="repair_order")
    outsourcing_records = relationship("OutsourcingRecord", back_populates="repair_order")
    completion_proofs = relationship("CompletionProof", back_populates="repair_order")
    audit_logs = relationship("AuditLog", back_populates="repair_order")


class ReminderRecord(Base):
    __tablename__ = "reminder_records"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    reminder_time = Column(DateTime(timezone=True), default=datetime.now)
    reminder_method = Column(String(50))
    reminder_content = Column(Text)
    reminder_by = Column(String(100))
    is_duplicate = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)

    repair_order = relationship("RepairOrder", back_populates="reminders")


class OutsourcingRecord(Base):
    __tablename__ = "outsourcing_records"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    outsourcer_id = Column(Integer, ForeignKey("handlers.id"))
    outsourcing_time = Column(DateTime(timezone=True), default=datetime.now)
    expected_completion = Column(DateTime(timezone=True))
    cost_estimate = Column(Integer)
    actual_cost = Column(Integer)
    status = Column(String(50), default="pending")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.now)

    repair_order = relationship("RepairOrder", back_populates="outsourcing_records")
    outsourcer = relationship("Handler", back_populates="outsourcing_records")


class CompletionProof(Base):
    __tablename__ = "completion_proofs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    proof_type = Column(String(50))
    proof_url = Column(String(500))
    description = Column(Text)
    uploaded_by = Column(String(100))
    uploaded_at = Column(DateTime(timezone=True), default=datetime.now)
    is_verified = Column(Boolean, default=False)
    verified_by = Column(String(100))
    verified_at = Column(DateTime(timezone=True))

    repair_order = relationship("RepairOrder", back_populates="completion_proofs")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    action = Column(String(100))
    old_status = Column(String(50))
    new_status = Column(String(50))
    operator = Column(String(100))
    original_input = Column(Text)
    conclusion = Column(Text)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.now)

    repair_order = relationship("RepairOrder", back_populates="audit_logs")
