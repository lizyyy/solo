import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class TaskStatus(enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    TRANSFERRED = "transferred"
    TIMEOUT = "timeout"


class Priority(enum.Enum):
    EMERGENCY = "emergency"
    URGENT = "urgent"
    NORMAL = "normal"
    LOW = "low"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True)
    patient_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer)
    gender = Column(String(10))
    department = Column(String(100))
    bed_number = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("InspectionTask", back_populates="patient")


class Escort(Base):
    __tablename__ = "escorts"

    id = Column(Integer, primary_key=True)
    escort_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    status = Column(String(20), default="available")
    current_task_count = Column(Integer, default=0)
    max_tasks = Column(Integer, default=3)
    total_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_tasks = relationship("InspectionTask", back_populates="assigned_escort")


class InspectionTask(Base):
    __tablename__ = "inspection_tasks"

    id = Column(Integer, primary_key=True)
    task_id = Column(String(50), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    inspection_type = Column(String(100), nullable=False)
    inspection_location = Column(String(200))
    priority = Column(String(20), default=Priority.NORMAL.value)
    status = Column(String(20), default=TaskStatus.PENDING.value)
    estimated_duration = Column(Integer)
    assigned_escort_id = Column(Integer, ForeignKey("escorts.id"))
    accepted_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    timeout_at = Column(DateTime)
    wait_time_seconds = Column(Integer, default=0)
    actual_duration_seconds = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    request_idempotency_key = Column(String(100), unique=True, index=True)

    patient = relationship("Patient", back_populates="tasks")
    assigned_escort = relationship("Escort", back_populates="assigned_tasks")
    history = relationship("TaskHistory", back_populates="task", order_by="TaskHistory.created_at")


class TaskHistory(Base):
    __tablename__ = "task_history"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(String(20))
    to_status = Column(String(20))
    operator_type = Column(String(20))
    operator_id = Column(String(50))
    reason = Column(Text)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("InspectionTask", back_populates="history")


class TransferRecord(Base):
    __tablename__ = "transfer_records"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    from_escort_id = Column(Integer, ForeignKey("escorts.id"), nullable=False)
    to_escort_id = Column(Integer, ForeignKey("escorts.id"), nullable=False)
    reason = Column(Text)
    transfer_time = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class DailyStatistics(Base):
    __tablename__ = "daily_statistics"

    id = Column(Integer, primary_key=True)
    date = Column(String(20), unique=True, nullable=False, index=True)
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    cancelled_tasks = Column(Integer, default=0)
    timeout_tasks = Column(Integer, default=0)
    emergency_tasks = Column(Integer, default=0)
    avg_wait_time_seconds = Column(Float, default=0)
    avg_completion_time_seconds = Column(Float, default=0)
    total_transfers = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
