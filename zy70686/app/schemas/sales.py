from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SalesRecordBase(BaseModel):
    store_id: int = Field(..., gt=0)
    material_id: int = Field(..., gt=0)
    quantity: float = Field(..., gt=0)
    sales_date: datetime


class SalesRecordCreate(SalesRecordBase):
    pass


class SalesRecordResponse(SalesRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
