from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ReservationBase(BaseModel):
    reservation_code: str = Field(..., min_length=1, max_length=50)
    instrument_id: int
    user_id: int
    research_group_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    purpose: Optional[str] = None
    status: str = "pending"
    is_approved: bool = False


class ReservationImport(BaseModel):
    reservation_code: str
    instrument_code: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    group_code: Optional[str] = None
    start_time: str
    end_time: str
    purpose: Optional[str] = None
    status: str = "pending"


class ReservationCreate(ReservationBase):
    pass


class ReservationUpdate(BaseModel):
    instrument_id: Optional[int] = None
    user_id: Optional[int] = None
    research_group_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    purpose: Optional[str] = None
    status: Optional[str] = None
    is_approved: Optional[bool] = None
    is_cancelled: Optional[bool] = None
    cancel_reason: Optional[str] = None


class ReservationResponse(ReservationBase):
    id: int
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_cancelled: bool = False
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancel_reason: Optional[str] = None
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
