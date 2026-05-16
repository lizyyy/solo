from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models.lock_audit import LockStatus, ExecutionPhase, ReleaseReason


class LockAuditBase(BaseModel):
    task_name: str = Field(..., description="任务名称")
    lock_key: str = Field(..., description="锁键")
    ttl_seconds: Optional[int] = Field(300, description="锁TTL（秒）")


class LockAuditCreate(LockAuditBase):
    client_info: Optional[str] = None


class LockAuditResponse(BaseModel):
    id: int
    task_name: str
    lock_key: str
    status: LockStatus
    execution_phase: Optional[ExecutionPhase]
    acquired_at: datetime
    last_renewed_at: Optional[datetime]
    expired_at: Optional[datetime]
    release_reason: Optional[ReleaseReason]
    release_time: Optional[datetime]
    audit_summary: Optional[str]
    is_dangerous_step_executed: bool
    dangerous_step_executed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LockAuditDetailResponse(LockAuditResponse):
    renew_history_count: int
    phase_history_count: int
    failure_record_count: int


class RenewHistoryResponse(BaseModel):
    id: int
    lock_audit_id: int
    renew_time: datetime
    success: bool
    previous_expire_time: Optional[datetime]
    new_expire_time: Optional[datetime]
    error_message: Optional[str]
    client_info: Optional[str]

    class Config:
        from_attributes = True


class PhaseHistoryResponse(BaseModel):
    id: int
    lock_audit_id: int
    phase: ExecutionPhase
    entered_at: datetime
    exited_at: Optional[datetime]
    duration_seconds: Optional[int]
    phase_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class FailureRecordResponse(BaseModel):
    id: int
    lock_audit_id: int
    failure_type: str
    original_input: Optional[Dict[str, Any]]
    processing_basis: Optional[Dict[str, Any]]
    final_conclusion: Optional[str]
    error_message: Optional[str]
    stack_trace: Optional[str]
    occurred_at: datetime
    resolved: bool
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_note: Optional[str]

    class Config:
        from_attributes = True


class ManualCorrectionResponse(BaseModel):
    id: int
    lock_audit_id: int
    corrected_by: str
    correction_type: str
    previous_status: Optional[LockStatus]
    new_status: Optional[LockStatus]
    previous_phase: Optional[ExecutionPhase]
    new_phase: Optional[ExecutionPhase]
    reason: str
    correction_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class RenewRequest(BaseModel):
    lock_key: str
    ttl_seconds: int = Field(300, description="续约时长（秒）")
    client_info: Optional[str] = None


class PhaseUpdateRequest(BaseModel):
    phase: ExecutionPhase
    phase_data: Optional[Dict[str, Any]] = None
    mark_dangerous_step: bool = False


class FailureRecordRequest(BaseModel):
    failure_type: str
    original_input: Optional[Dict[str, Any]] = None
    processing_basis: Optional[Dict[str, Any]] = None
    final_conclusion: Optional[str] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    corrected_by: str
    correction_type: str
    new_status: Optional[LockStatus] = None
    new_phase: Optional[ExecutionPhase] = None
    reason: str
    correction_data: Optional[Dict[str, Any]] = None
    mark_dangerous_step: Optional[bool] = None


class LockReleaseRequest(BaseModel):
    release_reason: ReleaseReason = ReleaseReason.NORMAL
    audit_summary: Optional[str] = None


class LockAuditQuery(BaseModel):
    task_name: Optional[str] = None
    lock_key: Optional[str] = None
    status: Optional[LockStatus] = None
    execution_phase: Optional[ExecutionPhase] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    has_failure: Optional[bool] = None
    page: int = 1
    page_size: int = 50


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


class ExportRequest(BaseModel):
    task_name: Optional[str] = None
    lock_key: Optional[str] = None
    status: Optional[LockStatus] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    export_format: str = Field("json", description="导出格式: json, csv")


class SelfCheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class SelfCheckResponse(BaseModel):
    overall_passed: bool
    checks: List[SelfCheckResult]
    checked_at: datetime
