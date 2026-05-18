from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReplenishmentOrderBase(BaseModel):
    store_id: int = Field(..., gt=0)
    material_id: int = Field(..., gt=0)
    quantity: float = Field(..., gt=0)
    priority: Optional[str] = "normal"
    estimated_arrival: Optional[datetime] = None
    remarks: Optional[str] = None
    created_by: Optional[str] = None


class ReplenishmentOrderCreate(ReplenishmentOrderBase):
    pass


class ReplenishmentOrderUpdate(BaseModel):
    quantity: Optional[float] = Field(None, gt=0)
    priority: Optional[str] = None
    estimated_arrival: Optional[datetime] = None
    remarks: Optional[str] = None
    need_manual_review: Optional[int] = None
    review_reason: Optional[str] = None


class ReplenishmentStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1)
    actual_arrival: Optional[datetime] = None
    handled_by: Optional[str] = None


class ReplenishmentOrderResponse(ReplenishmentOrderBase):
    id: int
    order_no: str
    status: str
    need_manual_review: int
    review_reason: Optional[str] = None
    actual_arrival: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
