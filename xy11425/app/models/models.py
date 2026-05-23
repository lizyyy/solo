from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

from ..database import Base
from .enums import BatchStatus, MaterialType, TaskStatus, TaskType, ReviewResult, IdempotencyStrategy


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default=BatchStatus.DRAFT, index=True)
    idempotency_key = Column(String(100), unique=True, index=True)
    idempotency_strategy = Column(String(20), default=IdempotencyStrategy.IGNORE)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    settled_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    extra_metadata = Column(JSON, default=dict)
    is_deleted = Column(Boolean, default=False)

    materials = relationship("Material", back_populates="batch", cascade="all, delete-orphan")
    state_changes = relationship("StateChange", back_populates="batch", cascade="all, delete-orphan")
    visitor_records = relationship("VisitorRecord", back_populates="batch", cascade="all, delete-orphan")
    tasks = relationship("AsyncTask", back_populates="batch", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_type = Column(String(50), index=True, nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_hash = Column(String(64), index=True)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    parsed = Column(Boolean, default=False)
    parsed_at = Column(DateTime(timezone=True))
    parse_error = Column(Text)
    extra_metadata = Column(JSON, default=dict)

    batch = relationship("Batch", back_populates="materials")


class StateChange(Base):
    __tablename__ = "state_changes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False, index=True)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    reason = Column(Text, nullable=False)
    extra_metadata = Column(JSON, default=dict)

    batch = relationship("Batch", back_populates="state_changes")


class VisitorRecord(Base):
    __tablename__ = "visitor_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"))
    visitor_name = Column(String(100), index=True)
    visitor_phone = Column(String(20), index=True)
    id_card = Column(String(20), index=True)
    license_plate = Column(String(20), index=True)
    visit_date = Column(DateTime(timezone=True), index=True)
    expected_end_date = Column(DateTime(timezone=True))
    actual_end_date = Column(DateTime(timezone=True))
    gate_in_time = Column(DateTime(timezone=True))
    gate_out_time = Column(DateTime(timezone=True))
    is_overstay = Column(Boolean, default=False)
    price_adjustment = Column(Float)
    review_status = Column(String(50))
    review_comment = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime(timezone=True))
    source = Column(String(50))
    extra_metadata = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("Batch", back_populates="visitor_records")
    audit_logs = relationship("AuditLog", back_populates="visitor_record")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    visitor_record_id = Column(Integer, ForeignKey("visitor_records.id"))
    action = Column(String(50), nullable=False, index=True)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String(100), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    extra_metadata = Column(JSON, default=dict)

    visitor_record = relationship("VisitorRecord", back_populates="audit_logs")


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    task_type = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default=TaskStatus.PENDING, index=True)
    priority = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_error = Column(Text)
    error_traceback = Column(Text)
    next_retry_at = Column(DateTime(timezone=True))
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_by = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    parameters = Column(JSON, default=dict)
    result = Column(JSON, default=dict)

    batch = relationship("Batch", back_populates="tasks")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text)
    value_type = Column(String(20), default="string")
    description = Column(String(255))
    updated_by = Column(String(100))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
