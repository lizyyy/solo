from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field

from app.models.instrument import InstrumentStatus


class InstrumentBase(BaseModel):
    code: str
    name: str
    specification: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    accuracy: Optional[str] = None
    measurement_range: Optional[str] = None
    location: Optional[str] = None
    calibration_period_months: int = Field(default=12)
    last_calibration_date: Optional[date] = None
    next_calibration_date: Optional[date] = None


class InstrumentCreate(InstrumentBase):
    pass


class InstrumentUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    specification: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    accuracy: Optional[str] = None
    measurement_range: Optional[str] = None
    location: Optional[str] = None
    status: Optional[InstrumentStatus] = None
    calibration_period_months: Optional[int] = None
    last_calibration_date: Optional[date] = None
    next_calibration_date: Optional[date] = None


class InstrumentResponse(InstrumentBase):
    id: int
    status: InstrumentStatus
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


class InstrumentStatusUpdate(BaseModel):
    new_status: InstrumentStatus
    remark: Optional[str] = None
