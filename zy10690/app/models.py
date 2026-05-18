from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PriorityStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    APPROVED = "approved"
    ACTIVE = "active"
    REJECTED = "rejected"
    RESTORED = "restored"


class QueuePriority(BaseModel):
    id: str
    model_name: str
    tenant_id: str
    queue_name: str
    original_priority: int
    target_priority: int
    reason: str
    applicant: str
    status: PriorityStatus
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    applied_at: Optional[datetime] = None
    restore_at: Optional[datetime] = None
    restored_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    wait_time_seconds: Optional[int] = None
    conclusion: Optional[str] = None


class QueuePriorityCreate(BaseModel):
    model_name: str
    tenant_id: str
    queue_name: str
    original_priority: int = Field(ge=1, le=10)
    target_priority: int = Field(ge=1, le=10)
    reason: str
    applicant: str
    restore_hours: int = Field(gt=0, le=168)


class QueuePriorityReview(BaseModel):
    reviewer: str
    approved: bool
    comment: Optional[str] = None


class QueuePriorityRestore(BaseModel):
    restorer: str
    reason: str


class PriorityReportItem(BaseModel):
    id: str
    model_name: str
    tenant_id: str
    queue_name: str
    original_priority: int
    target_priority: int
    reason: str
    applicant: str
    status: str
    reviewer: Optional[str]
    created_at: str
    applied_at: Optional[str]
    restored_at: Optional[str]
    wait_time_seconds: Optional[int]
    conclusion: Optional[str]
