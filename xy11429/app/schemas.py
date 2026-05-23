from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from .models import UserRole, LedgerStatus, DataSource, PermissionResult


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.OPERATOR


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OriginalEvidenceBase(BaseModel):
    source_type: DataSource
    source_file_name: str
    original_row_number: Optional[int] = None
    raw_data: Dict[str, Any]
    parsed_data: Optional[Dict[str, Any]] = None


class OriginalEvidenceResponse(OriginalEvidenceBase):
    id: int
    ledger_id: int
    import_batch_id: Optional[str] = None
    is_valid: bool
    validation_error: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VisitorLedgerBase(BaseModel):
    visitor_name: Optional[str] = None
    visitor_phone: Optional[str] = None
    visitor_id_card: Optional[str] = None
    visit_purpose: Optional[str] = None
    visited_person: Optional[str] = None
    visited_department: Optional[str] = None
    temp_plate_number: Optional[str] = None
    appointment_start_time: Optional[datetime] = None
    appointment_end_time: Optional[datetime] = None
    actual_entry_time: Optional[datetime] = None
    actual_exit_time: Optional[datetime] = None
    permission_granted_time: Optional[datetime] = None
    permission_revoked_time: Optional[datetime] = None


class VisitorLedgerCreate(VisitorLedgerBase):
    pass


class VisitorLedgerResponse(VisitorLedgerBase):
    id: int
    ledger_no: str
    is_cross_day: bool
    permission_result: PermissionResult
    status: LedgerStatus
    is_manual_judgment: bool
    judgment_reason: Optional[str] = None
    sensitive_fields_masked: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VisitorLedgerDetailResponse(VisitorLedgerResponse):
    evidences: List[OriginalEvidenceResponse] = []

    class Config:
        from_attributes = True


class VersionHistoryResponse(BaseModel):
    id: int
    ledger_id: int
    version_number: int
    action_type: str
    previous_state: Optional[Dict[str, Any]] = None
    current_state: Optional[Dict[str, Any]] = None
    diff_summary: Optional[Dict[str, Any]] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    change_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowLogResponse(BaseModel):
    id: int
    ledger_id: int
    action: str
    from_status: Optional[LedgerStatus] = None
    to_status: Optional[LedgerStatus] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    operator_role: Optional[str] = None
    comment: Optional[str] = None
    change_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowActionRequest(BaseModel):
    comment: Optional[str] = None
    change_reason: Optional[str] = None


class ImportResultItem(BaseModel):
    row_number: int
    success: bool
    ledger_no: Optional[str] = None
    error_message: Optional[str] = None


class ImportBatchResponse(BaseModel):
    batch_id: str
    source_type: DataSource
    file_name: str
    total_rows: int
    success_count: int
    failed_count: int
    skipped_count: int
    status: str
    results: List[ImportResultItem] = []
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupplementRecordCreate(BaseModel):
    supplement_type: str
    content: Dict[str, Any]
    remark: Optional[str] = None


class SupplementRecordResponse(SupplementRecordCreate):
    id: int
    ledger_id: int
    supplementary_by: Optional[int] = None
    supplementary_at: datetime

    class Config:
        from_attributes = True


class ManualJudgmentRequest(BaseModel):
    permission_result: PermissionResult
    judgment_reason: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class StatisticsResponse(BaseModel):
    total_records: int
    draft_count: int
    submitted_count: int
    confirmed_count: int
    cross_day_issue_count: int
    manual_judgment_count: int
    pending_review_count: int


class SecuritySupervisorView(BaseModel):
    role_summary: Dict[str, int]
    change_reason_distribution: Dict[str, int]
    cross_day_issues: List[VisitorLedgerResponse]
    recent_manual_judgments: List[VisitorLedgerResponse]
    pending_approvals: List[VisitorLedgerResponse]
