from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class KeyStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    ROTATING = "rotating"
    DEPRECATED = "deprecated"
    DEACTIVATED = "deactivated"


class KeyPurpose(str, Enum):
    DATA_ENCRYPTION = "data_encryption"
    TENANT_MASTER = "tenant_master"
    BACKUP = "backup"
    SIGNING = "signing"


class OperationType(str, Enum):
    CREATE = "create"
    ROTATE = "rotate"
    DEACTIVATE = "deactivate"
    MANUAL_CORRECT = "manual_correct"
    REFERENCE = "reference"


class TenantKey(Base):
    __tablename__ = "tenant_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    key_version = Column(String(50), nullable=False)
    purpose = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default=KeyStatus.PENDING)
    encryption_material = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    activated_at = Column(DateTime)
    deprecated_at = Column(DateTime)
    deactivated_at = Column(DateTime)
    rotation_batch_id = Column(String(100))
    approval_required = Column(Boolean, default=True)
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    is_protected = Column(Boolean, default=False)
    metadata_ = Column("metadata", JSON)

    references = relationship("KeyReference", back_populates="key")
    operation_logs = relationship("OperationLog", back_populates="key")


class KeyReference(Base):
    __tablename__ = "key_references"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key_id = Column(Integer, ForeignKey("tenant_keys.id"), nullable=False)
    tenant_id = Column(String(50), nullable=False, index=True)
    key_version = Column(String(50), nullable=False)
    data_batch_id = Column(String(100), nullable=False, index=True)
    purpose = Column(String(50))
    referenced_at = Column(DateTime, default=datetime.utcnow)
    reference_count = Column(Integer, default=1)
    metadata_ = Column("metadata", JSON)

    key = relationship("TenantKey", back_populates="references")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_type = Column(String(50), nullable=False)
    tenant_id = Column(String(50), nullable=False, index=True)
    key_id = Column(Integer, ForeignKey("tenant_keys.id"))
    key_version = Column(String(50))
    raw_input = Column(JSON)
    processing_rules = Column(JSON)
    conclusion = Column(String(500))
    success = Column(Boolean, nullable=False)
    error_message = Column(Text)
    operator = Column(String(100))
    operated_at = Column(DateTime, default=datetime.utcnow)

    key = relationship("TenantKey", back_populates="operation_logs")


class EscrowReport(Base):
    __tablename__ = "escrow_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(String(100), unique=True, nullable=False)
    tenant_id = Column(String(50), nullable=False, index=True)
    report_type = Column(String(50), nullable=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(100))
    content = Column(JSON, nullable=False)
    period_start = Column(DateTime)
    period_end = Column(DateTime)


class KeyCreateRequest(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=50)
    purpose: KeyPurpose
    encryption_material: str = Field(..., min_length=1)
    metadata: Optional[dict] = None
    operator: str = Field(..., min_length=1)


class KeyQueryRequest(BaseModel):
    tenant_id: Optional[str] = None
    purpose: Optional[KeyPurpose] = None
    status: Optional[KeyStatus] = None
    key_version: Optional[str] = None


class KeyReferenceRequest(BaseModel):
    tenant_id: str
    key_version: str
    data_batch_id: str
    purpose: Optional[str] = None
    metadata: Optional[dict] = None
    operator: str


class StatusAdvanceRequest(BaseModel):
    tenant_id: str
    key_version: str
    target_status: KeyStatus
    approved_by: Optional[str] = None
    operator: str
    reason: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    tenant_id: str
    key_version: str
    field_updates: dict
    operator: str
    reason: str


class ExportReportRequest(BaseModel):
    tenant_id: str
    report_type: str = "full_escrow"
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    operator: str


class ErrorRecordRequest(BaseModel):
    operation_type: OperationType
    tenant_id: str
    raw_input: dict
    processing_rules: dict
    error_message: str
    operator: str


class KeyResponse(BaseModel):
    id: int
    tenant_id: str
    key_version: str
    purpose: str
    status: str
    created_at: datetime
    activated_at: Optional[datetime]
    rotation_batch_id: Optional[str]
    approved_by: Optional[str]
    reference_count: int = 0

    class Config:
        orm_mode = True


class ReferenceResponse(BaseModel):
    id: int
    key_version: str
    data_batch_id: str
    referenced_at: datetime
    reference_count: int

    class Config:
        orm_mode = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    tenant_id: str
    key_version: Optional[str]
    success: bool
    conclusion: Optional[str]
    error_message: Optional[str]
    operator: str
    operated_at: datetime

    class Config:
        orm_mode = True


class ReportResponse(BaseModel):
    report_id: str
    tenant_id: str
    report_type: str
    generated_at: datetime
    content: dict
