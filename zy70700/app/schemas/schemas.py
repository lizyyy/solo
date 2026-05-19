from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models import (
    ToolStatus,
    ApprovalStatus,
    ExceptionStatus,
    MatchStatus,
)


class ToolBase(BaseModel):
    name: str
    mcp_server: str
    description: Optional[str] = None
    version: str = "1.0.0"
    status: ToolStatus = ToolStatus.ACTIVE


class ToolCreate(ToolBase):
    pass


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    mcp_server: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    status: Optional[ToolStatus] = None


class Tool(ToolBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PermissionDeclarationBase(BaseModel):
    tool_id: int
    batch_id: Optional[int] = None
    declared_scopes: List[str]
    declared_resources: Optional[List[str]] = None
    declared_actions: Optional[List[str]] = None
    declared_description: Optional[str] = None
    declared_by: Optional[str] = None


class PermissionDeclarationCreate(PermissionDeclarationBase):
    pass


class PermissionDeclarationUpdate(BaseModel):
    declared_scopes: Optional[List[str]] = None
    declared_resources: Optional[List[str]] = None
    declared_actions: Optional[List[str]] = None
    declared_description: Optional[str] = None
    is_active: Optional[bool] = None


class PermissionDeclaration(PermissionDeclarationBase):
    id: int
    declared_at: datetime
    match_status: MatchStatus
    match_score: int
    match_details: Optional[Dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActualCallBase(BaseModel):
    tool_id: int
    call_id: str
    actual_scopes: List[str]
    actual_resources: Optional[List[str]] = None
    actual_actions: Optional[List[str]] = None
    caller: Optional[str] = None
    request_payload: Optional[Dict[str, Any]] = None
    response_status: Optional[str] = None


class ActualCallCreate(ActualCallBase):
    pass


class ActualCall(ActualCallBase):
    id: int
    call_time: datetime
    archived: bool
    archived_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalBatchBase(BaseModel):
    batch_number: str
    title: str
    description: Optional[str] = None
    submitter: str


class ApprovalBatchCreate(ApprovalBatchBase):
    pass


class ApprovalBatchUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ApprovalStatus] = None
    approver: Optional[str] = None
    approval_notes: Optional[str] = None


class ApprovalBatch(ApprovalBatchBase):
    id: int
    status: ApprovalStatus
    approver: Optional[str] = None
    approval_time: Optional[datetime] = None
    approval_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    batch_id: Optional[int] = None
    tool_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    exception_type: Optional[str] = None
    original_input: Dict[str, Any]


class ExceptionRecordCreate(ExceptionRecordBase):
    pass


class ExceptionRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ExceptionStatus] = None
    handler: Optional[str] = None
    handling_conclusion: Optional[str] = None
    handling_notes: Optional[str] = None


class ExceptionRecord(ExceptionRecordBase):
    id: int
    status: ExceptionStatus
    handler: Optional[str] = None
    handling_time: Optional[datetime] = None
    handling_conclusion: Optional[str] = None
    handling_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditSummaryBase(BaseModel):
    summary_id: str
    title: str
    audit_period_start: datetime
    audit_period_end: datetime
    generated_by: Optional[str] = None


class AuditSummaryCreate(AuditSummaryBase):
    pass


class AuditSummary(AuditSummaryBase):
    id: int
    total_tools: int
    total_declarations: int
    matched_declarations: int
    mismatched_declarations: int
    partial_declarations: int
    total_calls: int
    total_exceptions: int
    resolved_exceptions: int
    summary_data: Optional[Dict[str, Any]] = None
    generated_at: datetime
    exported: bool
    exported_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PermissionMatchResult(BaseModel):
    declaration_id: int
    match_status: MatchStatus
    match_score: int
    match_details: Dict[str, Any]


class BatchApprovalRequest(BaseModel):
    batch_number: str
    approver: str
    notes: Optional[str] = None


class StatusChangeRequest(BaseModel):
    status: ApprovalStatus
    operator: str
    notes: Optional[str] = None


class ExceptionReviewRequest(BaseModel):
    status: ExceptionStatus
    handler: str
    handling_conclusion: str
    handling_notes: Optional[str] = None


class AuditExportRequest(BaseModel):
    summary_id: str
    format: str = "json"


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]
