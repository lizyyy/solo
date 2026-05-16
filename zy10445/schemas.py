from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from models import RequestStatus, AuditConclusion


class RepositoryBase(BaseModel):
    name: str
    owner: str
    description: Optional[str] = None


class RepositoryCreate(RepositoryBase):
    pass


class Repository(RepositoryBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class BranchRuleBase(BaseModel):
    branch_pattern: str
    require_pull_request: bool = True
    require_code_owner_review: bool = False
    required_approving_review_count: int = 1
    dismiss_stale_reviews: bool = True
    require_status_checks: bool = True


class BranchRuleCreate(BranchRuleBase):
    repository_id: int


class BranchRule(BranchRuleBase):
    id: int
    repository_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExceptionRequestBase(BaseModel):
    repository_id: int
    branch_pattern: str
    requester: str
    reason: str
    requested_duration_minutes: int


class ExceptionRequestCreate(ExceptionRequestBase):
    request_idempotency_key: str


class ExceptionRequestUpdate(BaseModel):
    status: Optional[RequestStatus] = None
    reason: Optional[str] = None


class ApprovalBase(BaseModel):
    approver: str
    comment: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    request_id: int


class Approval(ApprovalBase):
    id: int
    request_id: int
    approved_at: datetime

    class Config:
        from_attributes = True


class ReleaseWindowBase(BaseModel):
    original_settings_snapshot: str


class ReleaseWindowCreate(ReleaseWindowBase):
    request_id: int
    ends_at: datetime


class ReleaseWindow(ReleaseWindowBase):
    id: int
    request_id: int
    started_at: datetime
    ends_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class RestoreActionBase(BaseModel):
    restored_by: str
    is_manual: bool = False
    comment: Optional[str] = None
    success: bool = True


class RestoreActionCreate(RestoreActionBase):
    request_id: int


class RestoreAction(RestoreActionBase):
    id: int
    request_id: int
    restored_at: datetime

    class Config:
        from_attributes = True


class AuditRecordBase(BaseModel):
    action: str
    actor: str
    original_input: Optional[str] = None
    conclusion: AuditConclusion = AuditConclusion.NORMAL
    details: Optional[str] = None


class AuditRecordCreate(AuditRecordBase):
    request_id: int


class AuditRecord(AuditRecordBase):
    id: int
    request_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class ExceptionRequest(ExceptionRequestBase):
    id: int
    request_idempotency_key: str
    status: RequestStatus
    created_at: datetime
    updated_at: datetime
    approval: Optional[Approval] = None
    release_window: Optional[ReleaseWindow] = None
    restore_actions: List[RestoreAction] = []
    audit_records: List[AuditRecord] = []

    class Config:
        from_attributes = True


class ExceptionRequestDetail(ExceptionRequest):
    repository: Repository


class StatusTransitionRequest(BaseModel):
    actor: str
    comment: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    actor: str
    new_status: RequestStatus
    reason: str
    original_input: Optional[str] = None


class ExportFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    repository_id: Optional[int] = None
    status: Optional[RequestStatus] = None
    requester: Optional[str] = None
