from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MaterialBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=50)
    unit: str = Field(..., min_length=1, max_length=20)
    current_stock: float = Field(0.0, ge=0)
    unit_price: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=100)
    lead_time_days: int = Field(3, ge=1)
    status: Optional[str] = "active"


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    current_stock: Optional[float] = Field(None, ge=0)
    unit_price: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = Field(None, max_length=100)
    lead_time_days: Optional[int] = Field(None, ge=1)
    status: Optional[str] = None


class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
