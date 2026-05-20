from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from .models import ReleaseStatus, EnvironmentType, CheckItemStatus


class ApprovalBase(BaseModel):
    approver: str
    comment: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    pass


class Approval(ApprovalBase):
    id: int
    release_order_id: int
    approved: Optional[bool]
    approved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CheckItemBase(BaseModel):
    name: str
    description: Optional[str] = None


class CheckItemCreate(CheckItemBase):
    pass


class CheckItemUpdate(BaseModel):
    status: CheckItemStatus
    checked_by: str


class CheckItem(CheckItemBase):
    id: int
    release_order_id: int
    status: CheckItemStatus
    checked_by: Optional[str]
    checked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReleaseTokenBase(BaseModel):
    issued_by: str
    expires_hours: int = 2


class ReleaseTokenCreate(ReleaseTokenBase):
    pass


class ReleaseToken(BaseModel):
    id: int
    release_order_id: int
    token: str
    issued_by: str
    issued_at: datetime
    expires_at: datetime
    used: bool
    used_at: Optional[datetime]
    is_valid: bool

    class Config:
        from_attributes = True


class RollbackRecordBase(BaseModel):
    reason: str
    rolled_back_by: str
    previous_version: Optional[str] = None


class RollbackRecordCreate(RollbackRecordBase):
    pass


class RollbackRecord(RollbackRecordBase):
    id: int
    release_order_id: int
    rolled_back_at: datetime

    class Config:
        from_attributes = True


class TimelineEventBase(BaseModel):
    event_type: str
    description: str
    created_by: Optional[str] = None


class TimelineEventCreate(TimelineEventBase):
    pass


class TimelineEvent(TimelineEventBase):
    id: int
    release_order_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReleaseOrderBase(BaseModel):
    title: str
    description: Optional[str] = None
    version: Optional[str] = None
    environment: EnvironmentType
    created_by: str
    scheduled_at: Optional[datetime] = None
    timeout_hours: int = 24


class ReleaseOrderCreate(ReleaseOrderBase):
    check_items: List[CheckItemCreate] = Field(default_factory=list)
    approvers: List[str] = Field(default_factory=list)


class ReleaseOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class ReleaseOrder(ReleaseOrderBase):
    id: int
    status: ReleaseStatus
    created_at: datetime
    updated_at: datetime
    deployed_at: Optional[datetime]
    approvals: List[Approval] = []
    check_items: List[CheckItem] = []
    tokens: List[ReleaseToken] = []
    rollback_records: List[RollbackRecord] = []
    timeline: List[TimelineEvent] = []

    class Config:
        from_attributes = True


class ReleaseOrderSummary(BaseModel):
    id: int
    title: str
    version: Optional[str]
    environment: EnvironmentType
    status: ReleaseStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
    approvals_count: int
    approvals_passed: int
    check_items_count: int
    check_items_passed: int

    class Config:
        from_attributes = True


class ReleaseOrderFilter(BaseModel):
    status: Optional[ReleaseStatus] = None
    environment: Optional[EnvironmentType] = None
    created_by: Optional[str] = None
    search: Optional[str] = None


class StatusTransition(BaseModel):
    target_status: ReleaseStatus
    comment: Optional[str] = None
    operator: str


class TokenValidate(BaseModel):
    token: str


class BatchImportItem(BaseModel):
    title: str
    description: Optional[str] = None
    version: Optional[str] = None
    environment: EnvironmentType
    created_by: str
    check_items: List[CheckItemCreate] = Field(default_factory=list)
    approvers: List[str] = Field(default_factory=list)


class BatchImportResponse(BaseModel):
    success_count: int
    failed_count: int
    errors: List[str]
    created_ids: List[int]
