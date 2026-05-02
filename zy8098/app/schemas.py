from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class MealBase(BaseModel):
    date: str
    meal_type: str
    dish_name: str
    kitchen: str
    chef: str
    ingredients: str


class MealCreate(MealBase):
    pass


class Meal(MealBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SampleBase(BaseModel):
    box_code: str
    meal_id: int
    weight: float
    registered_by: str


class SampleCreate(SampleBase):
    pass


class Sample(SampleBase):
    id: int
    registered_at: datetime
    status: str
    expiry_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class SampleEventBase(BaseModel):
    event_type: str
    event_time: datetime
    fridge_code: Optional[str] = None
    operator: str
    notes: Optional[str] = None


class SampleEventCreate(SampleEventBase):
    sample_id: int


class SampleEvent(SampleEventBase):
    id: int
    sample_id: int
    sequence_number: int

    class Config:
        from_attributes = True


class FridgeBase(BaseModel):
    fridge_code: str
    location: str
    temperature_min: float
    temperature_max: float
    retention_hours: int = 48


class FridgeCreate(FridgeBase):
    pass


class Fridge(FridgeBase):
    id: int

    class Config:
        from_attributes = True


class FridgeRuleBase(BaseModel):
    rule_name: str
    fridge_code: str
    retention_hours: int
    temperature_min: float
    temperature_max: float
    priority: int = 0


class FridgeRuleCreate(FridgeRuleBase):
    pass


class FridgeRule(FridgeRuleBase):
    id: int

    class Config:
        from_attributes = True


class ScanInRequest(BaseModel):
    box_code: str
    fridge_code: str
    operator: str
    event_time: Optional[datetime] = None
    notes: Optional[str] = None


class ScanOutRequest(BaseModel):
    box_code: str
    operator: str
    event_time: Optional[datetime] = None
    notes: Optional[str] = None


class ComplaintTraceRequest(BaseModel):
    complaint_time: datetime
    date: str
    meal_type: str
    dish_name: Optional[str] = None


class TraceReportRequest(BaseModel):
    sample_id: Optional[int] = None
    box_code: Optional[str] = None


class ExpiryAlert(BaseModel):
    sample_id: int
    box_code: str
    dish_name: str
    expiry_time: datetime
    hours_left: float
    status: str


class TraceReport(BaseModel):
    sample: Sample
    meal: Meal
    events: List[SampleEvent]
    summary: str
