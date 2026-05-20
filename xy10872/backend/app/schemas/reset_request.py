from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.reset_request import ResetStatus


class ResetRequestBase(BaseModel):
    lab_space_id: int
    snapshot_id: int
    requested_by: str
    requested_by_name: str
    reason: Optional[str] = None


class ResetRequestCreate(ResetRequestBase):
    pass


class ResetStatusUpdate(BaseModel):
    status: ResetStatus
    status_reason: Optional[str] = None
    approved_by: Optional[str] = None


class ResetRequest(ResetRequestBase):
    id: int
    status: ResetStatus
    status_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResetRequestDetail(ResetRequest):
    lab_space_name: Optional[str] = None
    snapshot_name: Optional[str] = None
    retained_files_count: int = 0
    logs_count: int = 0