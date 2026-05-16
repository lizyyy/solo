import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship

from app.database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIAL_FAILED = "partial_failed"
    FAILED = "failed"


class RiskType(str, enum.Enum):
    GRAY_LOGISTICS = "gray_logistics"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_LEAKAGE = "data_leakage"
    ABNORMAL_USAGE = "abnormal_usage"
    OTHER = "other"


class FailureType(str, enum.Enum):
    DOWNLOAD_LINK_EXPIRED = "download_link_expired"
    MATERIAL_VERIFICATION_FAILED = "material_verification_failed"
    QUOTA_CALCULATION_ERROR = "quota_calculation_error"
    PERMISSION_DENIED = "permission_denied"
    NETWORK_ERROR = "network_error"
    INTERNAL_ERROR = "internal_error"


class QuotaRecycleTask(Base):
    __tablename__ = "quota_recycle_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    operator = Column(String(64), index=True, nullable=False)
    risk_type = Column(Enum(RiskType), index=True, nullable=False)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    material_url = Column(String(512), nullable=False)
    material_summary = Column(Text)
    total_target_quota = Column(Float, default=0.0)
    actual_recycled_quota = Column(Float, default=0.0)
    failed_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    failed_items = relationship("FailedItem", back_populates="task", cascade="all, delete-orphan")
    recycle_details = relationship("RecycleDetail", back_populates="task", cascade="all, delete-orphan")


class FailedItem(Base):
    __tablename__ = "failed_items"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("quota_recycle_tasks.id"), nullable=False)
    failure_type = Column(Enum(FailureType), index=True, nullable=False)
    tenant_id = Column(String(64), index=True)
    tenant_name = Column(String(128))
    error_message = Column(Text, nullable=False)
    raw_data = Column(Text)
    retry_count = Column(Integer, default=0)
    resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime)
    resolved_by = Column(String(64))
    resolution_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    task = relationship("QuotaRecycleTask", back_populates="failed_items")


class RecycleDetail(Base):
    __tablename__ = "recycle_details"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("quota_recycle_tasks.id"), nullable=False)
    tenant_id = Column(String(64), index=True, nullable=False)
    tenant_name = Column(String(128))
    original_quota = Column(Float, nullable=False)
    recycled_quota = Column(Float, nullable=False)
    remaining_quota = Column(Float, nullable=False)
    reason = Column(String(256))
    evidence_url = Column(String(512))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    task = relationship("QuotaRecycleTask", back_populates="recycle_details")


class LakehousePartition(Base):
    __tablename__ = "lakehouse_partitions"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("quota_recycle_tasks.id"))
    partition_path = Column(String(512), unique=True, index=True, nullable=False)
    partition_date = Column(String(32), index=True)
    record_count = Column(Integer, default=0)
    data_size_mb = Column(Float, default=0.0)
    manually_confirmed = Column(Boolean, default=False, index=True)
    confirmed_by = Column(String(64))
    confirmed_at = Column(DateTime)
    confirmation_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
