from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import ToolStatus, ApprovalStatus, AnomalyStatus, AnomalyType


class ToolBase(BaseModel):
    name: str
    server_name: str
    description: Optional[str] = None
    version: Optional[str] = None
    status: ToolStatus = ToolStatus.ACTIVE


class ToolCreate(ToolBase):
    pass


class Tool(ToolBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class DeclaredPermissionBase(BaseModel):
    permission_scope: str
    description: Optional[str] = None
    approved_by: Optional[str] = None
    is_active: bool = True


class DeclaredPermissionCreate(DeclaredPermissionBase):
    tool_id: int


class DeclaredPermission(DeclaredPermissionBase):
    id: int
    tool_id: int
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ActualCallBase(BaseModel):
    caller: str
    call_scope: str
    call_parameters: Optional[str] = None
    call_result: Optional[str] = None
    error_message: Optional[str] = None


class ActualCallCreate(ActualCallBase):
    tool_id: int
    batch_id: Optional[int] = None


class ActualCall(ActualCallBase):
    id: int
    tool_id: int
    batch_id: Optional[int] = None
    executed_at: datetime

    class Config:
        orm_mode = True


class ApprovalBatchBase(BaseModel):
    batch_number: str
    submitter: str
    description: Optional[str] = None


class ApprovalBatchCreate(ApprovalBatchBase):
    pass


class ApprovalBatchUpdate(BaseModel):
    status: ApprovalStatus
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None


class ApprovalBatch(ApprovalBatchBase):
    id: int
    status: ApprovalStatus
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class AnomalyBase(BaseModel):
    anomaly_type: AnomalyType
    actual_scope: str
    original_input: Optional[str] = None
    description: Optional[str] = None


class AnomalyCreate(AnomalyBase):
    tool_id: int
    call_id: Optional[int] = None
    declared_permission: Optional[str] = None


class AnomalyUpdate(BaseModel):
    status: Optional[AnomalyStatus] = None
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None


class AnomalyManualFix(BaseModel):
    declared_permission: str
    resolution: str
    resolved_by: str


class Anomaly(AnomalyBase):
    id: int
    tool_id: int
    call_id: Optional[int] = None
    declared_permission: Optional[str] = None
    status: AnomalyStatus
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class AuditSummaryBase(BaseModel):
    summary_type: str
    generated_by: Optional[str] = None
    export_format: Optional[str] = None


class AuditSummaryCreate(AuditSummaryBase):
    batch_id: Optional[int] = None
    total_tools: int = 0
    compliant_tools: int = 0
    non_compliant_tools: int = 0
    total_calls: int = 0
    anomalous_calls: int = 0
    anomaly_details: Optional[str] = None


class AuditSummary(AuditSummaryBase):
    id: int
    batch_id: Optional[int] = None
    total_tools: int
    compliant_tools: int
    non_compliant_tools: int
    total_calls: int
    anomalous_calls: int
    anomaly_details: Optional[str] = None
    generated_at: datetime
    export_path: Optional[str] = None

    class Config:
        orm_mode = True


class PermissionComparisonResult(BaseModel):
    tool_id: int
    tool_name: str
    declared_permissions: List[str]
    actual_scopes: List[str]
    is_compliant: bool
    mismatches: List[str]


class AuditExportResponse(BaseModel):
    summary_id: int
    export_format: str
    export_path: str
    generated_at: datetime
