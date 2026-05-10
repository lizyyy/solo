from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from pydantic import BaseModel, Field, validator

from .enums import (
    Season,
    AnimalStatus,
    AnimalHealth,
    DailyRationStatus
)


class BaseModelWithID(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Animal(BaseModelWithID):
    name: str
    species: str
    age_years: float = Field(ge=0, le=100)
    weight_kg: float = Field(gt=0, le=10000)
    health_status: AnimalHealth = AnimalHealth.HEALTHY
    status: AnimalStatus = AnimalStatus.ACTIVE
    area: str
    last_checkup_date: Optional[date] = None
    notes: Optional[str] = None

    @validator('weight_kg')
    def check_weight_positive(cls, v):
        if v <= 0:
            raise ValueError("体重必须大于0")
        return v

    def is_active(self) -> bool:
        return self.status == AnimalStatus.ACTIVE

    def needs_health_correction(self) -> bool:
        return self.health_status != AnimalHealth.HEALTHY


class FormulaIngredient(BaseModel):
    feed_name: str
    quantity_kg: float = Field(gt=0)
    unit: str = "kg"


class FeedFormula(BaseModelWithID):
    species: str
    season: Season
    name: str
    base_ratio_per_100kg: float = Field(gt=0)
    ingredients: List[FormulaIngredient]
    is_active: bool = True
    description: Optional[str] = None
    source: str = "standard"

    def calculate_base_ingredients(self, animal_weight: float) -> List[Dict[str, Any]]:
        multiplier = animal_weight / 100.0 * self.base_ratio_per_100kg
        return [
            {
                "feed_name": ing.feed_name,
                "quantity_kg": round(ing.quantity_kg * multiplier, 4),
                "unit": "kg"
            }
            for ing in self.ingredients
        ]


class HealthCorrectionRule(BaseModelWithID):
    health_status: AnimalHealth
    species: Optional[str] = None
    feed_name: Optional[str] = None
    ratio_multiplier: float = Field(default=1.0, gt=0)
    add_ingredients: List[FormulaIngredient] = Field(default_factory=list)
    remove_feeds: List[str] = Field(default_factory=list)
    priority: int = 0
    description: Optional[str] = None

    def applies_to(self, animal: Animal, feed_name: Optional[str] = None) -> bool:
        if animal.health_status != self.health_status:
            return False
        if self.species and animal.species != self.species:
            return False
        if self.feed_name and feed_name and self.feed_name != feed_name:
            return False
        return True


class FeedInventory(BaseModelWithID):
    feed_name: str
    current_qty_kg: float = Field(ge=0)
    min_threshold_kg: float = Field(ge=0)
    unit: str = "kg"
    location: str

    def is_available(self, required_qty: float) -> bool:
        return self.current_qty_kg >= required_qty

    def has_sufficient_for_multiple(self, required_qty: float, count: int = 1) -> bool:
        return self.current_qty_kg >= required_qty * count

    def is_below_threshold(self) -> bool:
        return self.current_qty_kg < self.min_threshold_kg


class RationItem(BaseModel):
    feed_name: str
    planned_quantity_kg: float
    actual_quantity_kg: Optional[float] = None
    unit: str = "kg"
    source_formula: Optional[str] = None
    correction_applied: Optional[List[str]] = None


class DailyRation(BaseModelWithID):
    ration_date: date
    animal_id: UUID
    animal_name: str
    animal_species: str
    season: Season
    status: DailyRationStatus = DailyRationStatus.DRAFT
    items: List[RationItem] = Field(default_factory=list)
    original_data_hash: Optional[str] = None
    formula_id: Optional[UUID] = None
    formula_name: Optional[str] = None
    corrections_applied: List[str] = Field(default_factory=list)
    verification_messages: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    executed_at: Optional[datetime] = None
    created_by: Optional[str] = None


class VerificationResult(BaseModel):
    success: bool
    stage: str
    messages: List[str]
    warnings: List[str]
    errors: List[str]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
