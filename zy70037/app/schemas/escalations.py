from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from .base import BaseSchema

class EscalationBase(BaseModel):
    dispatch_id: int
    level: int = 1
    escalated_to: str
    escalated_to_id: Optional[int] = None
    reason: str
    action_taken: Optional[str] = None

class EscalationCreate(EscalationBase):
    pass

class EscalationUpdate(BaseModel):
    action_taken: Optional[str] = None
    resolved: Optional[int] = None
    resolved_at: Optional[datetime] = None

class Escalation(BaseSchema):
    dispatch_id: int
    level: int
    escalated_at: datetime
    escalated_to: str
    escalated_to_id: Optional[int] = None
    reason: str
    action_taken: Optional[str] = None
    resolved: int
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EscalationQuery(BaseModel):
    dispatch_id: Optional[int] = None
    level: Optional[int] = None
    resolved: Optional[int] = None
    page: int = 1
    page_size: int = 10
