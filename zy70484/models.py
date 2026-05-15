from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Enum, Float
from sqlalchemy.sql import func
import enum
from database import Base


class TenantStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING_REVIEW = "PENDING_REVIEW"


class ProcessingStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"
    CACHE_STALE = "CACHE_STALE"
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS"


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    tenant_code = Column(String, unique=True, index=True, nullable=False)
    tenant_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    contact_person = Column(String)
    contact_phone = Column(String)
    status = Column(String, default=TenantStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SmsSendRecord(Base):
    __tablename__ = "sms_send_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True, nullable=False)
    tenant_code = Column(String, index=True, nullable=False)
    phone_number = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    send_time = Column(DateTime(timezone=True))
    operator = Column(String, nullable=False)
    department = Column(String, nullable=False)
    remark = Column(Text)
    is_backfill = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProcessingLog(Base):
    __tablename__ = "processing_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True, nullable=False)
    tenant_code = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)
    status = Column(String, nullable=False)
    input_summary = Column(Text)
    action_details = Column(Text)
    conclusion = Column(Text)
    error_message = Column(Text)
    logistics_screenshot_ref = Column(String)
    executed_by = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    duration_ms = Column(Integer)


class CacheState(Base):
    __tablename__ = "cache_states"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String, unique=True, index=True, nullable=False)
    cache_value = Column(Text)
    last_refresh_time = Column(DateTime(timezone=True), server_default=func.now())
    expire_time = Column(DateTime(timezone=True))
    is_stale = Column(Boolean, default=False)
    refresh_count = Column(Integer, default=0)


class MaterialSummary(Base):
    __tablename__ = "material_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    tenant_code = Column(String, nullable=False)
    summary_content = Column(Text, nullable=False)
    material_count = Column(Integer, default=0)
    export_token = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
