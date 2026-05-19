from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Float, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class PatientPriority(str, enum.Enum):
    NORMAL = "normal"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    TRANSFERRED = "transferred"


class AuditAction(str, enum.Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TRANSFERRED = "transferred"
    TIMEOUT = "timeout"
    PRIORITY_UPDATED = "priority_updated"


class Escort(Base):
    __tablename__ = "escorts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    current_task_count = Column(Integer, default=0)
    max_tasks = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tasks = relationship("Task", back_populates="escort")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    medical_record_no = Column(String, unique=True, index=True, nullable=False)
    age = Column(Integer)
    gender = Column(String)
    phone = Column(String)
    department = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tasks = relationship("Task", back_populates="patient")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String, unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    escort_id = Column(Integer, ForeignKey("escorts.id"), nullable=True)
    priority = Column(Enum(PatientPriority), default=PatientPriority.NORMAL)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    examination_type = Column(String, nullable=False)
    from_location = Column(String)
    to_location = Column(String)
    estimated_duration = Column(Integer, default=30)
    wait_time = Column(Integer, default=0)
    timeout_minutes = Column(Integer, default=30)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="tasks")
    escort = relationship("Escort", back_populates="tasks")
    audit_logs = relationship("AuditLog", back_populates="task")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    action = Column(Enum(AuditAction), nullable=False)
    old_status = Column(String)
    new_status = Column(String)
    old_escort_id = Column(Integer, nullable=True)
    new_escort_id = Column(Integer, nullable=True)
    operator = Column(String)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="audit_logs")


class BatchOperation(Base):
    __tablename__ = "batch_operations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    operation_type = Column(String, nullable=False)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


class BatchResult(Base):
    __tablename__ = "batch_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    task_no = Column(String)
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())