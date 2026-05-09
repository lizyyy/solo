from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel

from app.models.approval import ApprovalType, ApprovalStatus


class ApprovalBase(BaseModel):
    approval_type: ApprovalType
    instrument_id: int
    reason: str
    expected_action_date: Optional[date] = None


class ApprovalCreate(ApprovalBase):
    pass


class ApprovalProcess(BaseModel):
    status: ApprovalStatus
    approval_remark: Optional[str] = None


class ApprovalResponse(ApprovalBase):
    id: int
    request_no: str
    requester_id: int
    requester_name: Optional[str] = None
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
    status: ApprovalStatus
    approval_remark: Optional[str] = None
    approval_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
