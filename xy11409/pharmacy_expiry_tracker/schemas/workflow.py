from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from pharmacy_expiry_tracker.models.enums import ChangeType


class WorkflowActionRequest(BaseModel):
    action: ChangeType = Field(..., description="操作类型")
    operator: str = Field(..., description="操作人")
    operator_role: str = Field(..., description="操作人角色")
    change_reason: Optional[str] = Field(None, description="变更原因")
    ip_address: Optional[str] = Field(None, description="IP地址")


class ChangeReasonRequest(BaseModel):
    change_reason: str = Field(..., description="变更原因")
    operator: str = Field(..., description="操作人")
    operator_role: str = Field(..., description="操作人角色")


class FreezeRequest(BaseModel):
    frozen: bool = Field(..., description="是否冻结")
    operator: str = Field(..., description="操作人")
    change_reason: Optional[str] = Field(None, description="冻结原因")


class ChangeLogResponse(BaseModel):
    id: int
    expiry_record_id: int
    change_type: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    change_reason: Optional[str] = None
    changed_by: str
    changed_at: datetime
    user_role: Optional[str] = None

    class Config:
        from_attributes = True
