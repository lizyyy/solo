from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BillBase(BaseModel):
    bill_code: str = Field(..., min_length=1, max_length=50)
    user_id: int
    reservation_id: Optional[int] = None
    instrument_id: Optional[int] = None
    research_group_id: Optional[int] = None
    bill_date: datetime
    base_duration_hours: float = 0.0
    base_amount: float = 0.0
    overtime_duration_hours: float = 0.0
    overtime_amount: float = 0.0
    night_duration_hours: float = 0.0
    night_amount: float = 0.0
    discount_amount: float = 0.0
    discount_reason: Optional[str] = None
    total_amount: float = 0.0
    status: str = "pending"
    is_waived: bool = False
    waive_reason: Optional[str] = None
    is_paid: bool = False
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    base_duration_hours: Optional[float] = None
    base_amount: Optional[float] = None
    overtime_duration_hours: Optional[float] = None
    overtime_amount: Optional[float] = None
    night_duration_hours: Optional[float] = None
    night_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    total_amount: Optional[float] = None
    status: Optional[str] = None
    is_waived: Optional[bool] = None
    waive_reason: Optional[str] = None
    is_paid: Optional[bool] = None
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class BillResponse(BillBase):
    id: int
    waived_by: Optional[str] = None
    waived_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
