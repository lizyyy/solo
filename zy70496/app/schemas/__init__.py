from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class RiskType(str, Enum):
    DATA_LEAKAGE = "data_leakage"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    MALWARE = "malware"
    POLICY_VIOLATION = "policy_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    CONFLICT = "conflict"


class EvidenceSource(str, Enum):
    SECURITY_LOG = "security_log"
    NETWORK_TRAFFIC = "network_traffic"
    ENDPOINT_LOG = "endpoint_log"
    ACCESS_LOG = "access_log"
    DATABASE_AUDIT = "database_audit"


class EvidenceRecordBase(BaseModel):
    evidence_id: str
    source: EvidenceSource
    device_name: Optional[str] = None
    device_ip: Optional[str] = None
    risk_level: Optional[str] = None
    evidence_path: Optional[str] = None
    evidence_hash: Optional[str] = None
    collected_at: Optional[datetime] = None


class EvidenceRecordCreate(EvidenceRecordBase):
    pass


class EvidenceRecordUpdate(BaseModel):
    status: Optional[ProcessingStatus] = None
    error_message: Optional[str] = None


class EvidenceRecord(EvidenceRecordBase):
    id: str
    batch_id: str
    status: ProcessingStatus
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    environment_name: str
    operator: str
    risk_type: RiskType
    description: Optional[str] = None
    original_input: Optional[str] = None
    processing_basis: Optional[str] = None


class BatchCreate(BatchBase):
    evidence_records: List[EvidenceRecordCreate]


class BatchPreviewResult(BaseModel):
    total_count: int
    existing_count: int
    new_count: int
    conflict_count: int
    conflict_details: List[dict]
    will_reuse_existing: bool


class BatchUpdate(BaseModel):
    status: Optional[ProcessingStatus] = None
    description: Optional[str] = None
    processing_basis: Optional[str] = None


class Batch(BatchBase):
    id: str
    status: ProcessingStatus
    created_at: datetime
    updated_at: datetime
    evidence_records: List[EvidenceRecord] = []
    authorizations: List["DownloadAuthorization"] = []

    class Config:
        from_attributes = True


class DownloadAuthorizationBase(BaseModel):
    authorized_to: str
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class DownloadAuthorizationCreate(DownloadAuthorizationBase):
    batch_id: str
    authorized_by: str


class DownloadAuthorization(BaseModel):
    id: str
    batch_id: str
    authorized_by: str
    authorized_to: str
    authorized_at: datetime
    expires_at: Optional[datetime] = None
    is_used: bool
    used_at: Optional[datetime] = None
    used_by: Optional[str] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class BatchQueryFilter(BaseModel):
    batch_no: Optional[str] = None
    operator: Optional[str] = None
    risk_type: Optional[RiskType] = None
    environment_name: Optional[str] = None
    status: Optional[ProcessingStatus] = None


class AuthorizationQueryFilter(BaseModel):
    batch_id: Optional[str] = None
    authorized_to: Optional[str] = None
    authorized_by: Optional[str] = None
    is_used: Optional[bool] = None


class MarkdownRequest(BaseModel):
    batch_id: str


Batch.model_rebuild()
