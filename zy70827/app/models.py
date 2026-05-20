from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class TaskStatus(str, enum.Enum):
    PROCESSING = "processing"
    FAILED = "failed"
    MANUAL_CONFIRM = "manual_confirm"
    EXPORTED = "exported"


class DataCategory(str, enum.Enum):
    NORMAL = "normal"
    NEED_SUPPLEMENT = "need_supplement"
    BLOCKED = "blocked"


class SampleStatus(str, enum.Enum):
    PENDING = "pending"
    SHIPPED = "shipped"
    RECEIVED = "received"
    RETURNED = "returned"
    SETTLED = "settled"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100))
    email = Column(String(100))
    hashed_password = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    audit_logs = relationship("AuditLog", back_populates="operator")


class SampleTask(Base):
    __tablename__ = "sample_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_no = Column(String(50), index=True, nullable=True)
    batch_no = Column(String(50), index=True)
    
    status = Column(Enum(TaskStatus), default=TaskStatus.PROCESSING)
    category = Column(Enum(DataCategory), nullable=True)
    category_reason = Column(Text)
    
    raw_data = Column(Text, nullable=False)
    source_file = Column(String(200))
    row_number = Column(Integer)
    
    submitted_by = Column(String(50))
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))
    
    brand_batch_id = Column(Integer, ForeignKey("brand_batches.id"))
    talent_schedule_id = Column(Integer, ForeignKey("talent_schedules.id"))
    
    brand_batch = relationship("BrandBatch", back_populates="tasks")
    talent_schedule = relationship("TalentSchedule", back_populates="tasks")
    samples = relationship("Sample", back_populates="task", cascade="all, delete-orphan")
    error_details = relationship("ErrorDetail", back_populates="task", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="task", cascade="all, delete-orphan")
    deposit_records = relationship("DepositRecord", back_populates="task", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("sample_tasks.id"), nullable=False)
    
    sample_code = Column(String(50), index=True, nullable=True)
    sample_name = Column(String(200), nullable=True)
    quantity = Column(Integer, default=1)
    unit = Column(String(20), default="件")
    
    status = Column(Enum(SampleStatus), default=SampleStatus.PENDING)
    
    has_damage_photo = Column(Boolean, default=False)
    damage_photo_url = Column(String(500))
    
    shipped_at = Column(DateTime(timezone=True))
    received_at = Column(DateTime(timezone=True))
    returned_at = Column(DateTime(timezone=True))
    settled_at = Column(DateTime(timezone=True))
    
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    task = relationship("SampleTask", back_populates="samples")


class BrandBatch(Base):
    __tablename__ = "brand_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    brand_name = Column(String(200), nullable=False)
    product_line = Column(String(100))
    
    batch_date = Column(DateTime(timezone=True))
    total_samples = Column(Integer, default=0)
    
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    tasks = relationship("SampleTask", back_populates="brand_batch")


class TalentSchedule(Base):
    __tablename__ = "talent_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_no = Column(String(50), unique=True, index=True, nullable=False)
    talent_name = Column(String(100), nullable=False)
    talent_id = Column(String(50), index=True)
    
    live_date = Column(DateTime(timezone=True), nullable=False)
    platform = Column(String(50))
    room_id = Column(String(50))
    
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    tasks = relationship("SampleTask", back_populates="talent_schedule")


class DepositRecord(Base):
    __tablename__ = "deposit_records"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("sample_tasks.id"), nullable=False)
    
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="CNY")
    
    deduction_reason = Column(Text)
    deducted_at = Column(DateTime(timezone=True))
    deducted_by = Column(String(50))
    
    is_settled = Column(Boolean, default=False)
    settled_at = Column(DateTime(timezone=True))
    
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("SampleTask", back_populates="deposit_records")


class ErrorDetail(Base):
    __tablename__ = "error_details"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("sample_tasks.id"), nullable=False)
    
    error_type = Column(String(50), nullable=False)
    error_field = Column(String(100))
    error_message = Column(Text, nullable=False)
    
    source_ref = Column(String(200))
    row_number = Column(Integer)
    column_ref = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("SampleTask", back_populates="error_details")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("sample_tasks.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(String(50), nullable=False)
    field_changed = Column(String(100))
    
    old_value = Column(Text)
    new_value = Column(Text)
    
    reason = Column(Text, nullable=False)
    
    operated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    task = relationship("SampleTask", back_populates="audit_logs")
    operator = relationship("User", back_populates="audit_logs")
