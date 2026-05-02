from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SwipeLogBase(BaseModel):
    card_number: str = Field(..., min_length=1, max_length=50)
    swipe_time: datetime
    instrument_id: Optional[int] = None
    user_id: Optional[int] = None
    reservation_id: Optional[int] = None
    swipe_type: str = "enter"
    device_id: Optional[str] = None
    is_matched: bool = False
    match_status: Optional[str] = None
    is_manual_release: bool = False
    manual_release_reason: Optional[str] = None


class SwipeLogImport(BaseModel):
    swipe_code: Optional[str] = None
    card_number: str
    swipe_time: str
    instrument_code: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    reservation_code: Optional[str] = None
    swipe_type: str = "enter"
    device_id: Optional[str] = None


class SwipeLogCreate(SwipeLogBase):
    swipe_code: Optional[str] = None


class SwipeLogUpdate(BaseModel):
    instrument_id: Optional[int] = None
    user_id: Optional[int] = None
    reservation_id: Optional[int] = None
    is_matched: Optional[bool] = None
    match_status: Optional[str] = None
    is_manual_release: Optional[bool] = None
    manual_release_by: Optional[str] = None
    manual_release_reason: Optional[str] = None


class SwipeLogResponse(SwipeLogBase):
    id: int
    swipe_code: Optional[str] = None
    manual_release_by: Optional[str] = None
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
