from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any


class IngredientType(Enum):
    WAX = "wax"
    FRAGRANCE = "fragrance"
    ADDITIVE = "additive"
    CONTAINER = "container"


class NoteType(Enum):
    TOP = "top"
    MIDDLE = "middle"
    BASE = "base"


@dataclass
class Ingredient:
    name: str
    type: IngredientType
    unit_price: float
    unit: str
    max_ratio: Optional[float] = None
    flash_point: Optional[float] = None
    allergen_tags: List[str] = field(default_factory=list)
    note_type: Optional[NoteType] = None
    half_life: Optional[float] = None
    volatility_coefficient: Optional[float] = None
    notes: str = ""


@dataclass
class RecipeIngredient:
    name: str
    amount: float
    unit: str
    ingredient: Optional[Ingredient] = None


@dataclass
class Recipe:
    name: str
    description: str = ""
    ingredients: List[RecipeIngredient] = field(default_factory=list)
    total_batch_size: float = 0.0
    total_batch_unit: str = "g"
    target_per_cup_capacity: float = 0.0
    target_per_cup_unit: str = "g"
    container_count: int = 1
    target_per_cup_cost: float = 0.0
    notes: str = ""


@dataclass
class CostResult:
    total_batch_cost: float
    per_cup_cost: float
    per_unit_cost: float
    cost_breakdown: Dict[str, float]


@dataclass
class LoadRatioResult:
    total_fragrance_amount: float
    total_wax_amount: float
    fragrance_load_ratio: float
    wax_ratio: float
    additive_ratio: float


@dataclass
class VolatilizationPoint:
    time_hours: float
    top_intensity: float
    middle_intensity: float
    base_intensity: float
    total_intensity: float
    dominant_notes: List[str]


@dataclass
class VolatilizationResult:
    time_points: List[VolatilizationPoint]
    longevity_hours: float
    top_duration_hours: float
    middle_duration_hours: float
    base_duration_hours: float
    scent_score: float
    base_note_gap: bool = False
    base_gap_start_hours: Optional[float] = None


@dataclass
class RiskItem:
    level: str
    category: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskResult:
    risks: List[RiskItem]
    high_count: int
    medium_count: int
    low_count: int


@dataclass
class AnalysisResult:
    recipe: Recipe
    cost_result: CostResult
    load_ratio_result: LoadRatioResult
    volatilization_result: VolatilizationResult
    risk_result: RiskResult
