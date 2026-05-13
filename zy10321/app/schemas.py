from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models import FreezeStatus, ChangeStatus, ExceptionStatus, ApprovalRole


class ServiceGroupBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None


class ServiceGroupCreate(ServiceGroupBase):
    pass


class ServiceGroup(ServiceGroupBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FreezeCalendarBase(BaseModel):
    name: str = Field(..., max_length=100)
    service_group_id: int
    start_time: datetime
    end_time: datetime
    reason: Optional[str] = None
    created_by: Optional[str] = None


class FreezeCalendarCreate(FreezeCalendarBase):
    pass


class FreezeCalendar(FreezeCalendarBase):
    id: int
    status: FreezeStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApproverBase(BaseModel):
    user_id: str = Field(..., max_length=100)
    user_name: str = Field(..., max_length=100)
    email: Optional[str] = None
    role: ApprovalRole = ApprovalRole.REVIEWER
    service_group_id: Optional[int] = None


class ApproverCreate(ApproverBase):
    pass


class Approver(ApproverBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChangeOrderBase(BaseModel):
    change_id: str = Field(..., max_length=100)
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    service_group_id: int
    planned_time: datetime
    requester: str = Field(..., max_length=100)


class ChangeOrderCreate(ChangeOrderBase):
    idempotency_key: Optional[str] = None


class ChangeOrder(ChangeOrderBase):
    id: int
    status: ChangeStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExceptionRequestBase(BaseModel):
    request_id: str = Field(..., max_length=100)
    change_id: int
    freeze_id: int
    reason: str
    requester: str = Field(..., max_length=100)
    is_emergency: bool = False


class ExceptionRequestCreate(ExceptionRequestBase):
    pass


class ExceptionApprove(BaseModel):
    approver: str = Field(..., max_length=100)
    status: ExceptionStatus


class ExceptionRequest(ExceptionRequestBase):
    id: int
    approver: Optional[str] = None
    status: ExceptionStatus
    approved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlockLogBase(BaseModel):
    change_id: int
    freeze_id: int
    reason: Optional[str] = None


class BlockLogCreate(BlockLogBase):
    pass


class BlockLog(BlockLogBase):
    id: int
    block_time: datetime
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ValidationResult(BaseModel):
    allowed: bool
    status: ChangeStatus
    message: str
    matched_freezes: List[FreezeCalendar] = []
    block_log_id: Optional[int] = None


class ErrorResponse(BaseModel):
    error: str
    code: str
    details: Optional[dict] = None
