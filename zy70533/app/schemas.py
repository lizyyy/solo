from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, List, Any
from .enums import FreezeStatus, ChangeType, ApprovalStatus, ExceptionType


class ExperimentFreezeBase(BaseModel):
    experiment_id: str
    parameter_version: str
    metric_window_start: datetime
    metric_window_end: datetime
    parameters: Dict[str, Any]
    metrics_config: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None


class ExperimentFreezeCreate(ExperimentFreezeBase):
    created_by: str


class ExperimentFreezeUpdate(BaseModel):
    status: Optional[FreezeStatus] = None
    remarks: Optional[str] = None


class ExperimentFreezeResponse(ExperimentFreezeBase):
    id: int
    freeze_time: datetime
    status: FreezeStatus
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ParameterSnapshotBase(BaseModel):
    version: str
    parameters: Dict[str, Any]


class ParameterSnapshotCreate(ParameterSnapshotBase):
    freeze_id: int
    created_by: str


class ParameterSnapshotResponse(ParameterSnapshotBase):
    id: int
    freeze_id: int
    snapshot_time: datetime
    hash: str
    created_by: str

    class Config:
        from_attributes = True


class ChangeRequestBase(BaseModel):
    change_type: ChangeType
    proposed_parameters: Dict[str, Any]
    reason: str


class ChangeRequestCreate(ChangeRequestBase):
    freeze_id: int
    requested_by: str


class ChangeRequestApprove(BaseModel):
    approval_status: ApprovalStatus
    approval_remarks: Optional[str] = None
    approved_by: str


class ChangeRequestResponse(ChangeRequestBase):
    id: int
    freeze_id: int
    original_parameters: Dict[str, Any]
    requested_by: str
    requested_at: datetime
    approval_status: ApprovalStatus
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approval_remarks: Optional[str] = None
    is_blocked: bool
    block_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    exception_type: ExceptionType
    error_code: Optional[str] = None
    original_input: Dict[str, Any]
    processing_basis: Dict[str, Any]
    final_conclusion: Dict[str, Any]


class ExceptionRecordCreate(ExceptionRecordBase):
    freeze_id: int


class ExceptionRecordResolve(BaseModel):
    resolution_details: str
    resolved_by: str


class ExceptionRecordResponse(ExceptionRecordBase):
    id: int
    freeze_id: int
    occurred_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_details: Optional[str] = None
    is_resolved: bool

    class Config:
        from_attributes = True


class FreezeReportBase(BaseModel):
    report_type: str
    content: Dict[str, Any]


class FreezeReportCreate(FreezeReportBase):
    freeze_id: int
    generated_by: str
    file_format: str = "json"


class FreezeReportResponse(FreezeReportBase):
    id: int
    freeze_id: int
    generated_by: str
    generated_at: datetime
    file_path: Optional[str] = None
    file_format: str

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    freeze_id: int
    action: str
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    operator: str
    operated_at: datetime
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ManualCorrectionRequest(BaseModel):
    freeze_id: int
    corrected_parameters: Dict[str, Any]
    correction_reason: str
    corrected_by: str


class ExportRequest(BaseModel):
    freeze_id: int
    export_format: str = "json"
    include_exception_records: bool = True
    include_change_requests: bool = True
    include_audit_logs: bool = True


class StatusAdvanceRequest(BaseModel):
    freeze_id: int
    target_status: FreezeStatus
    operator: str
    remarks: Optional[str] = None


class FreezeDetailResponse(BaseModel):
    experiment_freeze: ExperimentFreezeResponse
    parameter_snapshots: List[ParameterSnapshotResponse]
    change_requests: List[ChangeRequestResponse]
    exception_records: List[ExceptionRecordResponse]
    freeze_reports: List[FreezeReportResponse]
    audit_logs: List[AuditLogResponse]
