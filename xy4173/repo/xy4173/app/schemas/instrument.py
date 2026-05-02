from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class InstrumentBase(BaseModel):
    instrument_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    location: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    hourly_rate: float = 0.0
    overtime_rate: float = 0.0
    max_reservation_hours: int = 8
    is_active: bool = True
    requires_approval: bool = False


class InstrumentCreate(InstrumentBase):
    pass


class InstrumentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    hourly_rate: Optional[float] = None
    overtime_rate: Optional[float] = None
    max_reservation_hours: Optional[int] = None
    is_active: Optional[bool] = None
    requires_approval: Optional[bool] = None


class InstrumentResponse(InstrumentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
