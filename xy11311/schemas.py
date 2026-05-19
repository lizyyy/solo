from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import RecordStatus, ExceptionType


class ElderlyBase(BaseModel):
    name: str
    room_number: Optional[str] = None
    delivery_route: Optional[str] = None
    phone: Optional[str] = None
    chronic_conditions: Optional[str] = None
    allergies: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    notes: Optional[str] = None


class ElderlyCreate(ElderlyBase):
    pass


class ElderlyUpdate(ElderlyBase):
    pass


class ElderlyResponse(ElderlyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class MealRecordBase(BaseModel):
    elderly_id: int
    meal_date: datetime
    meal_type: Optional[str] = "午餐"
    menu_items: str
    handled_by: str


class MealRecordCreate(MealRecordBase):
    pass


class MealRecordResponse(BaseModel):
    id: int
    elderly_id: int
    elderly_name: str
    meal_date: datetime
    meal_type: str
    menu_items: str
    status: RecordStatus
    exception_type: ExceptionType
    reason: str
    handled_by: str
    created_at: datetime

    class Config:
        orm_mode = True


class MealChangeHistoryResponse(BaseModel):
    id: int
    meal_record_id: int
    previous_menu: str
    new_menu: str
    changed_by: str
    change_reason: str
    created_at: datetime

    class Config:
        orm_mode = True


class MealValidationResult(BaseModel):
    status: RecordStatus
    exception_type: ExceptionType
    reason: str
    warnings: List[str] = Field(default_factory=list)


class QueryFilter(BaseModel):
    handled_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[RecordStatus] = None
    exception_type: Optional[ExceptionType] = None


class MealRecordUpdate(BaseModel):
    menu_items: str
    changed_by: str
    change_reason: str
