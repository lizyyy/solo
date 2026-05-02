from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AuditLogBase(BaseModel):
    log_code: str = Field(..., min_length=1, max_length=50)
    action: str = Field(..., min_length=1, max_length=100)
    action_type: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    resource_code: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_success: str = "success"
    error_message: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
