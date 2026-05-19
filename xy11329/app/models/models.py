from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import TaskStatus, TaskPriority, Role, OperationType, ExceptionType


class Escort(Base):
    __tablename__ = "escorts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    tasks = relationship("Task", back_populates="assigned_escort")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    medical_record_no = Column(String(50), index=True)
    phone = Column(String(20))
    department = Column(String(100))
    bed_no = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)

    tasks = relationship("Task", back_populates="patient")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(100), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    assigned_escort_id = Column(Integer, ForeignKey("escorts.id"))
    status = Column(String(20), default=TaskStatus.PENDING, index=True)
    priority = Column(String(20), default=TaskPriority.NORMAL, index=True)
    service_type = Column(String(100))
    from_location = Column(String(200))
    to_location = Column(String(200))
    description = Column(Text)
    queue_position = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.now, index=True)
    assigned_at = Column(DateTime)
    accepted_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    timeout_at = Column(DateTime)
    
    wait_duration = Column(Integer)
    service_duration = Column(Integer)
    total_duration = Column(Integer)
    
    operator_role = Column(String(20))
    operator_name = Column(String(100))
    
    has_exception = Column(Boolean, default=False)
    exception_type = Column(String(50))
    exception_note = Column(Text)
    
    patient = relationship("Patient", back_populates="tasks")
    assigned_escort = relationship("Escort", back_populates="tasks")
    audit_logs = relationship("AuditLog", back_populates="task")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    operation_type = Column(String(50), nullable=False)
    operator_role = Column(String(20), nullable=False)
    operator_name = Column(String(100), nullable=False)
    old_status = Column(String(20))
    new_status = Column(String(20))
    old_escort_id = Column(Integer)
    new_escort_id = Column(Integer)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.now, index=True)
    
    task = relationship("Task", back_populates="audit_logs")
