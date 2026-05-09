from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseSchema

class TemperatureEventBase(BaseModel):
    freezer_id: int
    temperature: float
    event_type: str = Field(..., description="事件类型: high_temp(高温), low_temp(低温), sensor_error(传感器错误)")
    status: str = "pending"
    detected_at: Optional[datetime] = None
    description: Optional[str] = None

class TemperatureEventCreate(TemperatureEventBase):
    pass

class TemperatureEventUpdate(BaseModel):
    status: Optional[str] = None
    resolved_at: Optional[datetime] = None
    description: Optional[str] = None

class TemperatureEvent(BaseSchema):
    freezer_id: int
    temperature: float
    event_type: str
    status: str
    detected_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

class TemperatureEventQuery(BaseModel):
    freezer_id: Optional[int] = None
    status: Optional[str] = None
    event_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    page: int = 1
    page_size: int = 10
