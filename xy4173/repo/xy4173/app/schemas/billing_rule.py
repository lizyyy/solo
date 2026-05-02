from datetime import datetime, time
from typing import Optional
from pydantic import BaseModel, Field


class BillingRuleBase(BaseModel):
    rule_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    instrument_id: Optional[int] = None
    research_group_id: Optional[int] = None
    base_hourly_rate: float = 0.0
    overtime_rate_multiplier: float = 1.5
    overtime_start_hours: int = 0
    night_rate_multiplier: float = 1.0
    night_start_time: time = time(22, 0)
    night_end_time: time = time(6, 0)
    weekend_rate_multiplier: float = 1.5
    discount_rate: float = 1.0
    discount_reason: Optional[str] = None
    priority: int = 0
    is_active: bool = True
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None


class BillingRuleCreate(BillingRuleBase):
    pass


class BillingRuleUpdate(BaseModel):
    name: Optional[str] = None
    instrument_id: Optional[int] = None
    research_group_id: Optional[int] = None
    base_hourly_rate: Optional[float] = None
    overtime_rate_multiplier: Optional[float] = None
    overtime_start_hours: Optional[int] = None
    night_rate_multiplier: Optional[float] = None
    night_start_time: Optional[time] = None
    night_end_time: Optional[time] = None
    weekend_rate_multiplier: Optional[float] = None
    discount_rate: Optional[float] = None
    discount_reason: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None


class BillingRuleResponse(BillingRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
