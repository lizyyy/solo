import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum, Boolean, Float
from sqlalchemy.orm import relationship
from app.database import Base


class RepairOrderStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    OUTSOURCED = "outsourced"
    COMPLETED = "completed"
    VERIFIED = "verified"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class UrgencyLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    EMERGENCY = "emergency"


class RepairOrder(Base):
    __tablename__ = "repair_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    building = Column(String, index=True)
    room_number = Column(String, index=True)
    contact_name = Column(String)
    contact_phone = Column(String)
    issue_type = Column(String)
    description = Column(Text)
    urgency = Column(Enum(UrgencyLevel), default=UrgencyLevel.MEDIUM)
    status = Column(Enum(RepairOrderStatus), default=RepairOrderStatus.PENDING)
    handler_id = Column(Integer, ForeignKey("handlers.id"), nullable=True)
    timeout_hours = Column(Integer, default=24)
    is_timeout = Column(Boolean, default=False)
    is_duplicated = Column(Boolean, default=False)
    original_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    handler = relationship("Handler", back_populates="repair_orders")
    reminders = relationship("Reminder", back_populates="repair_order", cascade="all, delete-orphan")
    outsourcing = relationship("Outsourcing", back_populates="repair_order", uselist=False)
    completion_proof = relationship("CompletionProof", back_populates="repair_order", uselist=False)
    exception_records = relationship("ExceptionRecord", back_populates="repair_order", cascade="all, delete-orphan")
    duplicates = relationship("RepairOrder", backref="original_order", remote_side=[id])


class Handler(Base):
    __tablename__ = "handlers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone = Column(String)
    department = Column(String)
    is_outsourcer = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    repair_orders = relationship("RepairOrder", back_populates="handler")


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    reminder_time = Column(DateTime, default=datetime.utcnow)
    reminder_method = Column(String)
    reminder_content = Column(Text)
    operator = Column(String)
    is_merged = Column(Boolean, default=False)
    merged_into_id = Column(Integer, ForeignKey("reminders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="reminders")


class Outsourcing(Base):
    __tablename__ = "outsourcings"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), unique=True)
    outsourcer_name = Column(String)
    outsourcer_contact = Column(String)
    dispatch_time = Column(DateTime, default=datetime.utcnow)
    promised_completion_time = Column(DateTime, nullable=True)
    actual_completion_time = Column(DateTime, nullable=True)
    cost = Column(Float, nullable=True)
    status = Column(String, default="dispatched")
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="outsourcing")


class CompletionProof(Base):
    __tablename__ = "completion_proofs"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), unique=True)
    proof_type = Column(String)
    proof_content = Column(Text)
    image_urls = Column(Text, nullable=True)
    submitter = Column(String)
    submit_time = Column(DateTime, default=datetime.utcnow)
    verifier = Column(String, nullable=True)
    verify_time = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
    verify_remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="completion_proof")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    operation_type = Column(String)
    original_input = Column(Text)
    operator = Column(String)
    conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    repair_order = relationship("RepairOrder", back_populates="exception_records")
