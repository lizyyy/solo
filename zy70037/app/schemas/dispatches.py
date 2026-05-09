from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseSchema

class DispatchBase(BaseModel):
    temperature_event_id: int
    provider_id: int
    worker_id: Optional[int] = None
    priority: str = "normal"
    notes: Optional[str] = None

class DispatchCreate(DispatchBase):
    pass

class DispatchUpdate(BaseModel):
    provider_id: Optional[int] = None
    worker_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    target_time: Optional[datetime] = None
    notes: Optional[str] = None

class Dispatch(BaseSchema):
    temperature_event_id: int
    provider_id: int
    worker_id: Optional[int] = None
    dispatch_code: str
    status: str
    priority: str
    dispatched_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    target_time: Optional[datetime] = None
    escalation_level: int
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class DispatchQuery(BaseModel):
    temperature_event_id: Optional[int] = None
    provider_id: Optional[int] = None
    worker_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    escalation_level: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 10

class DispatchAssign(BaseModel):
    worker_id: int
    notes: Optional[str] = None

class DispatchAccept(BaseModel):
    notes: Optional[str] = None

class DispatchComplete(BaseModel):
    notes: Optional[str] = None
