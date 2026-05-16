from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ReceiptStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    BLOCKED = "blocked"
    REVOKED = "revoked"
    COMPENSATED = "compensated"


class DiffType(str, Enum):
    MISSING_KEY = "missing_key"
    VALUE_MISMATCH = "value_mismatch"
    TYPE_MISMATCH = "type_mismatch"
    EXTRA_KEY = "extra_key"


class DiffSegment(BaseModel):
    id: str
    diff_type: DiffType
    key_path: str
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None
    description: Optional[str] = None


class ReceiptReport(BaseModel):
    total_checks: int = 0
    passed_checks: int = 0
    failed_checks: int = 0
    diff_count: int = 0
    has_critical_diff: bool = False
    summary: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class AuditLog(BaseModel):
    id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: Optional[str] = None
    operation: str
    from_status: Optional[ReceiptStatus] = None
    to_status: Optional[ReceiptStatus] = None
    reason: Optional[str] = None
    original_input: Optional[Dict[str, Any]] = None
    processing_basis: Optional[Dict[str, Any]] = None
    final_conclusion: Optional[str] = None


class ConfigReceipt(BaseModel):
    id: str
    service_name: str
    config_version: str
    snapshot_version: str
    instance_id: str
    receipt_time: Optional[datetime] = None
    status: ReceiptStatus = ReceiptStatus.PENDING
    diffs: List[DiffSegment] = Field(default_factory=list)
    report: Optional[ReceiptReport] = None
    raw_payload: Optional[Dict[str, Any]] = None
    audit_logs: List[AuditLog] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    timeout_at: Optional[datetime] = None
    remarks: Optional[str] = None


class ConfigReceiptCreate(BaseModel):
    service_name: str
    config_version: str
    snapshot_version: str
    instance_id: str
    raw_payload: Optional[Dict[str, Any]] = None
    expected_config: Optional[Dict[str, Any]] = None
    actual_config: Optional[Dict[str, Any]] = None


class ConfigReceiptQuery(BaseModel):
    service_name: Optional[str] = None
    config_version: Optional[str] = None
    snapshot_version: Optional[str] = None
    instance_id: Optional[str] = None
    status: Optional[ReceiptStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    has_diff: Optional[bool] = None


class StatusUpdateRequest(BaseModel):
    status: ReceiptStatus
    operator: Optional[str] = None
    reason: Optional[str] = None
    processing_basis: Optional[Dict[str, Any]] = None
    final_conclusion: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    operator: str
    reason: str
    corrected_diffs: Optional[List[DiffSegment]] = None
    corrected_report: Optional[ReceiptReport] = None
    processing_basis: Dict[str, Any]
    final_conclusion: str


class ReceiptSummary(BaseModel):
    service_name: str
    config_version: str
    snapshot_version: str
    total_instances: int
    pending_count: int
    confirmed_count: int
    blocked_count: int
    revoked_count: int
    compensated_count: int
    timeout_count: int
    has_any_diff: bool
    created_at: datetime
