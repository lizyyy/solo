from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class LightingSetItemBase(BaseModel):
    item_code: str = Field(..., max_length=50)
    item_name: str = Field(..., max_length=200)
    category: str = Field(..., max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0)
    status: str = Field(default="normal", max_length=50)
    serial_number: Optional[str] = Field(None, max_length=200)
    condition_description: Optional[str] = None


class LightingSetItemCreate(LightingSetItemBase):
    pass


class LightingSetItemUpdate(BaseModel):
    item_code: Optional[str] = Field(None, max_length=50)
    item_name: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = Field(None, ge=1)
    unit_price: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=50)
    serial_number: Optional[str] = Field(None, max_length=200)
    condition_description: Optional[str] = None


class LightingSetItem(LightingSetItemBase):
    id: int
    lighting_set_id: int

    class Config:
        from_attributes = True


class LightingSetBase(BaseModel):
    set_code: str = Field(..., max_length=50)
    set_name: str = Field(..., max_length=200)
    store: str = Field(..., max_length=100)
    responsible_person: str = Field(..., max_length=100)
    status: str = Field(default="available", max_length=50)
    daily_rental_price: float = Field(..., ge=0)
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_phone: Optional[str] = Field(None, max_length=50)
    event_name: Optional[str] = Field(None, max_length=200)
    event_location: Optional[str] = Field(None, max_length=300)
    remarks: Optional[str] = None


class LightingSetCreate(LightingSetBase):
    items: List[LightingSetItemCreate]


class LightingSetUpdate(BaseModel):
    set_name: Optional[str] = Field(None, max_length=200)
    store: Optional[str] = Field(None, max_length=100)
    responsible_person: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    daily_rental_price: Optional[float] = Field(None, ge=0)
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_phone: Optional[str] = Field(None, max_length=50)
    event_name: Optional[str] = Field(None, max_length=200)
    event_location: Optional[str] = Field(None, max_length=300)
    remarks: Optional[str] = None
    items: Optional[List[LightingSetItemCreate]] = None


class LightingSet(LightingSetBase):
    id: int
    total_value: float
    created_date: datetime
    last_updated: Optional[datetime] = None
    completeness_score: float
    items: List[LightingSetItem]

    class Config:
        from_attributes = True


class LightingSetQuery(BaseModel):
    set_code: Optional[str] = None
    set_name: Optional[str] = None
    store: Optional[str] = None
    responsible_person: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    customer_name: Optional[str] = None


class BatchImportResult(BaseModel):
    total: int
    success: int
    failed: int
    results: List[dict]
