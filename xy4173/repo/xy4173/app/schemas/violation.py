from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ViolationBase(BaseModel):
    violation_code: str = Field(..., min_length=1, max_length=50)
    violation_type: str = Field(..., min_length=1, max_length=50)
    user_id: Optional[int] = None
    reservation_id: Optional[int] = None
    swipe_log_id: Optional[int] = None
    sample_id: Optional[int] = None
    bill_id: Optional[int] = None
    instrument_id: Optional[int] = None
    research_group_id: Optional[int] = None
    detected_at: datetime
    severity: str = "low"
    description: Optional[str] = None
    details: Optional[str] = None
    suggested_fine_amount: float = 0.0
    status: str = "pending"
    is_resolved: bool = False
    resolution_notes: Optional[str] = None


class ViolationCreate(ViolationBase):
    pass


class ViolationUpdate(BaseModel):
    severity: Optional[str] = None
    description: Optional[str] = None
    details: Optional[str] = None
    suggested_fine_amount: Optional[float] = None
    status: Optional[str] = None
    is_resolved: Optional[bool] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None


class ViolationResponse(ViolationBase):
    id: int
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
