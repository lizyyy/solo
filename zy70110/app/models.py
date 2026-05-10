from datetime import datetime, date
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Float, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum

from app.database import Base


class AppointmentStatus(str, PyEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_INSPECTION = "in_inspection"
    INSPECTION_PASSED = "inspection_passed"
    INSPECTION_FAILED = "inspection_failed"
    IN_LOADING = "in_loading"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"
    FAILED = "failed"


class StorageStatus(str, PyEnum):
    AVAILABLE = "available"
    LOCKED = "locked"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class InspectionStatus(str, PyEnum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SkipType(str, PyEnum):
    OVERDUE = "overdue"
    MANUAL = "manual"
    TECHNICAL = "technical"


class ColdStorageBay(Base):
    __tablename__ = "cold_storage_bays"

    id = Column(Integer, primary_key=True, index=True)
    bay_code = Column(String(20), unique=True, index=True, nullable=False)
    bay_name = Column(String(100), nullable=False)
    zone = Column(String(50), nullable=False)
    temperature_zone = Column(String(50), nullable=False)
    capacity_cubic_meters = Column(Float, nullable=False)
    status = Column(String(20), default=StorageStatus.AVAILABLE)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    storage_locks = relationship("StorageLock", back_populates="storage_bay")


class InspectionWindow(Base):
    __tablename__ = "inspection_windows"

    id = Column(Integer, primary_key=True, index=True)
    window_code = Column(String(20), unique=True, index=True, nullable=False)
    window_name = Column(String(100), nullable=False)
    capacity_per_hour = Column(Integer, default=5)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    queue_records = relationship("InspectionQueue", back_populates="inspection_window")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    appointment_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    contact_phone = Column(String(20), nullable=False)
    license_plate = Column(String(20), nullable=False)
    driver_name = Column(String(50), nullable=False)
    product_type = Column(String(100), nullable=False)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    volume_cubic_meters = Column(Float, nullable=False)
    temperature_requirement = Column(String(50), nullable=False)
    scheduled_date = Column(Date, nullable=False)
    scheduled_time_slot = Column(String(20), nullable=False)
    status = Column(String(30), default=AppointmentStatus.PENDING)
    storage_bay_id = Column(Integer, ForeignKey("cold_storage_bays.id"), nullable=True)
    priority = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    storage_bay = relationship("ColdStorageBay")
    storage_lock = relationship("StorageLock", back_populates="appointment", uselist=False)
    queue_record = relationship("InspectionQueue", back_populates="appointment", uselist=False)
    skip_records = relationship("SkipRecord", back_populates="appointment")
    loading_receipt = relationship("LoadingReceipt", back_populates="appointment", uselist=False)
    failed_tasks = relationship("FailedTask", back_populates="appointment")


class StorageLock(Base):
    __tablename__ = "storage_locks"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    storage_bay_id = Column(Integer, ForeignKey("cold_storage_bays.id"), nullable=False)
    locked_at = Column(DateTime, default=datetime.utcnow)
    lock_expiry_time = Column(DateTime, nullable=False)
    is_released = Column(Boolean, default=False)
    released_at = Column(DateTime, nullable=True)
    release_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="storage_lock")
    storage_bay = relationship("ColdStorageBay", back_populates="storage_locks")


class InspectionQueue(Base):
    __tablename__ = "inspection_queue"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    inspection_window_id = Column(Integer, ForeignKey("inspection_windows.id"), nullable=False)
    queue_number = Column(Integer, nullable=False)
    queue_date = Column(Date, default=date.today)
    status = Column(String(20), default=InspectionStatus.WAITING)
    checked_in_time = Column(DateTime, nullable=True)
    inspection_start_time = Column(DateTime, nullable=True)
    inspection_end_time = Column(DateTime, nullable=True)
    expected_wait_minutes = Column(Integer, nullable=True)
    actual_wait_minutes = Column(Integer, nullable=True)
    inspector_name = Column(String(50), nullable=True)
    inspection_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="queue_record")
    inspection_window = relationship("InspectionWindow", back_populates="queue_records")


class SkipRecord(Base):
    __tablename__ = "skip_records"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    skip_type = Column(String(20), nullable=False)
    skip_time = Column(DateTime, default=datetime.utcnow)
    skip_reason = Column(Text, nullable=False)
    original_queue_number = Column(Integer, nullable=False)
    new_queue_number = Column(Integer, nullable=True)
    is_reassigned = Column(Boolean, default=False)
    reassigned_at = Column(DateTime, nullable=True)
    operator_name = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="skip_records")


class LoadingReceipt(Base):
    __tablename__ = "loading_receipts"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    receipt_no = Column(String(50), unique=True, index=True, nullable=False)
    storage_bay_id = Column(Integer, ForeignKey("cold_storage_bays.id"), nullable=False)
    loading_start_time = Column(DateTime, nullable=True)
    loading_end_time = Column(DateTime, nullable=True)
    actual_quantity = Column(Float, nullable=False)
    actual_volume = Column(Float, nullable=False)
    temperature_reading = Column(Float, nullable=True)
    handler_name = Column(String(50), nullable=True)
    acceptance_status = Column(String(20), default="accepted")
    discrepancy_notes = Column(Text, nullable=True)
    customer_confirmation = Column(Boolean, default=False)
    confirmed_by = Column(String(50), nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="loading_receipt")


class FailedTask(Base):
    __tablename__ = "failed_tasks"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    task_type = Column(String(50), nullable=False)
    task_description = Column(String(200), nullable=False)
    error_message = Column(Text, nullable=False)
    error_details = Column(Text, nullable=True)
    occurred_at = Column(DateTime, default=datetime.utcnow)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_retry_at = Column(DateTime, nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = relationship("Appointment", back_populates="failed_tasks")
