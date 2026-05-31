from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    ABNORMAL = "abnormal"


class AbnormalType(str, Enum):
    AUTHORIZATION_EXPIRED = "authorization_expired"
    COLOR_VERSION_MIXED = "color_version_mixed"
    EXPORT_SPEC_MISSED = "export_spec_missed"
    LATE_ATTACHMENT = "late_attachment"
    DUPLICATE = "duplicate"
    MANUAL_CORRECTION = "manual_correction"


class MaterialSource(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    sheet_name: Optional[str] = None
    original_value: Optional[str] = None


class VerificationInfo(BaseModel):
    reason: str
    evidence: List[str]
    source_files: List[MaterialSource]


class ProofRecord(BaseModel):
    record_id: str
    material_name: str
    color_version: str
    spec: str
    authorization_no: str
    authorization_valid_until: datetime
    submitted_at: datetime
    attachment_arrived_at: Optional[datetime] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    has_manual_correction: bool = False
    correction_note: Optional[str] = None
    status: RecordStatus = RecordStatus.NORMAL
    abnormal_types: List[AbnormalType] = Field(default_factory=list)
    verification: Optional[VerificationInfo] = None
    source: Optional[MaterialSource] = None


class AuthorizationFile(BaseModel):
    file_path: str
    authorization_no: str
    valid_until: datetime
    authorized_color_versions: List[str]
    authorized_specs: List[str]


class MaterialPackage(BaseModel):
    package_id: str
    package_name: str
    received_at: datetime
    records: List[ProofRecord] = Field(default_factory=list)
    authorization_files: List[AuthorizationFile] = Field(default_factory=list)
    raw_files: List[str] = Field(default_factory=list)


class DeliverySummary(BaseModel):
    generated_at: datetime
    total_records: int
    normal_count: int
    pending_count: int
    abnormal_count: int
    normal_records: List[ProofRecord] = Field(default_factory=list)
    pending_records: List[ProofRecord] = Field(default_factory=list)
    abnormal_records: List[ProofRecord] = Field(default_factory=list)
    pending_reasons: Dict[str, List[str]] = Field(default_factory=dict)
    abnormal_details: Dict[str, List[str]] = Field(default_factory=dict)
