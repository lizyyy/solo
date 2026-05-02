from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from .models import SubstitutionStatus, BatchStatus, AuditAction, AllergenType


class ChildBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    student_id: str = Field(..., min_length=1, max_length=50)
    class_name: str = Field(..., min_length=1, max_length=50)
    allergens: Optional[str] = None
    forbidden_foods: Optional[str] = None
    is_active: bool = True


class ChildCreate(ChildBase):
    pass


class ChildUpdate(BaseModel):
    name: Optional[str] = None
    class_name: Optional[str] = None
    allergens: Optional[str] = None
    forbidden_foods: Optional[str] = None
    is_active: Optional[bool] = None


class ChildResponse(ChildBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IngredientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    batch_number: str = Field(..., min_length=1, max_length=100)
    supplier: Optional[str] = None
    production_date: Optional[date] = None
    expiry_date: Optional[date] = None
    allergens: Optional[str] = None
    ingredients_list: Optional[str] = None
    status: BatchStatus = BatchStatus.ACTIVE
    recall_reason: Optional[str] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    supplier: Optional[str] = None
    production_date: Optional[date] = None
    expiry_date: Optional[date] = None
    allergens: Optional[str] = None
    ingredients_list: Optional[str] = None
    status: Optional[BatchStatus] = None
    recall_reason: Optional[str] = None


class IngredientResponse(IngredientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MenuItemBase(BaseModel):
    menu_date: date
    meal_type: str = Field(..., min_length=1, max_length=50)
    dish_name: str = Field(..., min_length=1, max_length=200)
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
    notes: Optional[str] = None


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    menu_date: Optional[date] = None
    meal_type: Optional[str] = None
    dish_name: Optional[str] = None
    ingredients: Optional[str] = None
    allergens: Optional[str] = None
    notes: Optional[str] = None


class MenuItemResponse(MenuItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubstitutionRequestBase(BaseModel):
    child_id: int
    menu_item_id: Optional[int] = None
    request_date: date
    original_dish: str = Field(..., min_length=1, max_length=200)
    substitution_dish: Optional[str] = None
    reason: str = Field(..., min_length=1)


class SubstitutionRequestCreate(SubstitutionRequestBase):
    pass


class SubstitutionRequestUpdate(BaseModel):
    substitution_dish: Optional[str] = None
    status: Optional[SubstitutionStatus] = None
    approver: Optional[str] = None
    approval_notes: Optional[str] = None


class SubstitutionRequestResponse(SubstitutionRequestBase):
    id: int
    status: SubstitutionStatus
    approver: Optional[str]
    approval_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    action: AuditAction
    entity_type: str
    entity_id: Optional[int]
    details: Optional[str]
    operator: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


class BlockRecordResponse(BaseModel):
    id: int
    child_id: int
    menu_item_id: int
    block_date: date
    reason: str
    allergens_found: Optional[str]
    is_substituted: bool
    substitution_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AllergenCheckResult(BaseModel):
    child_name: str
    student_id: str
    class_name: str
    dish_name: str
    meal_type: str
    menu_date: date
    has_conflict: bool
    matched_allergens: List[str]
    risk_level: str
    recommendation: str


class DailyMealPlan(BaseModel):
    date: date
    meal_type: str
    safe_assignments: List[dict]
    blocked_assignments: List[dict]
    substitutions_needed: List[dict]


class ImportResult(BaseModel):
    success: bool
    total: int
    imported: int
    errors: List[str]
    skipped: int


class BatchRecallRequest(BaseModel):
    batch_number: str
    reason: str
