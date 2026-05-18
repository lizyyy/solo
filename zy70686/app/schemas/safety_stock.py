from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SafetyStockBase(BaseModel):
    store_id: int = Field(..., gt=0)
    material_id: int = Field(..., gt=0)
    min_stock: float = Field(..., ge=0)
    max_stock: float = Field(..., ge=0)
    reorder_point: float = Field(..., ge=0)
    forecast_days: int = Field(7, ge=1)
    safety_factor: float = Field(1.5, ge=1.0)


class SafetyStockCreate(SafetyStockBase):
    pass


class SafetyStockUpdate(BaseModel):
    min_stock: Optional[float] = Field(None, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    reorder_point: Optional[float] = Field(None, ge=0)
    forecast_days: Optional[int] = Field(None, ge=1)
    safety_factor: Optional[float] = Field(None, ge=1.0)


class SafetyStockResponse(SafetyStockBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
