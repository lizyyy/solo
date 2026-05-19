from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from app.models.models import ElderStatus, MealStatus, ChronicDisease
import re


def mask_id_card(id_card: Optional[str]) -> Optional[str]:
    if not id_card or len(id_card) < 8:
        return id_card
    return id_card[:4] + "********" + id_card[-4:]


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone or len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[-4:]


class ElderBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    id_card: Optional[str] = Field(None, max_length=18)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=10)
    room_number: Optional[str] = Field(None, max_length=50)
    route_id: Optional[int] = None
    dietary_restrictions: Optional[str] = None
    chronic_diseases: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None

    @field_validator('id_card')
    @classmethod
    def validate_id_card(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^\d{17}[\dXx]$', v):
                raise ValueError('身份证格式不正确')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^1[3-9]\d{9}$', v):
                raise ValueError('手机号格式不正确')
        return v


class ElderCreate(ElderBase):
    pass


class ElderUpdate(ElderBase):
    status: Optional[ElderStatus] = None


class Elder(ElderBase):
    id: int
    status: ElderStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ElderSafe(BaseModel):
    name: str
    id_card: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    room_number: Optional[str] = None
    route_id: Optional[int] = None
    dietary_restrictions: Optional[str] = None
    chronic_diseases: Optional[str] = None
    allergies: Optional[str] = None
    notes: Optional[str] = None
    id: int
    status: ElderStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

    @field_validator('id_card', mode='before')
    @classmethod
    def mask_id_card_field(cls, v: Optional[str]) -> Optional[str]:
        return mask_id_card(v)

    @field_validator('phone', mode='before')
    @classmethod
    def mask_phone_field(cls, v: Optional[str]) -> Optional[str]:
        return mask_phone(v)


class DeliveryRouteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    sequence: int = 0
    is_active: bool = True


class DeliveryRouteCreate(DeliveryRouteBase):
    pass


class DeliveryRouteUpdate(DeliveryRouteBase):
    pass


class DeliveryRoute(DeliveryRouteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MenuBase(BaseModel):
    date: date
    meal_type: str = Field(..., pattern=r'^(breakfast|lunch|dinner)$')
    route_id: Optional[int] = None
    main_dish: str = Field(..., min_length=1, max_length=200)
    side_dish1: Optional[str] = Field(None, max_length=200)
    side_dish2: Optional[str] = Field(None, max_length=200)
    soup: Optional[str] = Field(None, max_length=200)
    staple: Optional[str] = Field(None, max_length=100)
    special_notes: Optional[str] = None


class MenuCreate(MenuBase):
    pass


class MenuUpdate(MenuBase):
    pass


class Menu(MenuBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MealDistributionBase(BaseModel):
    elder_id: int
    menu_id: int
    special_requirements: Optional[str] = None
    actual_dishes: Optional[str] = None


class MealDistributionCreate(MealDistributionBase):
    pass


class MealDistributionReview(BaseModel):
    status: MealStatus
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None


class MealDistributionDelivery(BaseModel):
    status: MealStatus
    delivery_notes: Optional[str] = None
    delivered_by: Optional[str] = None


class MealDistribution(MealDistributionBase):
    id: int
    status: MealStatus
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime]
    review_notes: Optional[str] = None
    delivered_by: Optional[str] = None
    delivered_at: Optional[datetime]
    delivery_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MealDistributionDetail(MealDistribution):
    elder: ElderSafe
    menu: Menu


class AuditLogBase(BaseModel):
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    operator: Optional[str] = None
    ip_address: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changes: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: int = 0
    failed: int = 0
    errors: List[str] = []
    warnings: List[str] = []


class DailyReport(BaseModel):
    report_date: date
    total_meals: int
    confirmed_meals: int
    pending_meals: int
    cancelled_meals: int
    special_requirements_count: int
    routes: List[dict]


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
    errors: Optional[List[str]] = None
