from datetime import date, datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class ElderlyInfo:
    elderly_id: str
    name: Optional[str] = None
    chronic_diseases: List[str] = field(default_factory=list)
    dietary_restrictions: List[str] = field(default_factory=list)
    age: Optional[int] = None
    gender: Optional[str] = None
    bed_number: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class DishInfo:
    dish_code: str
    dish_name: str
    dish_category: str
    energy_per_100g: float = 0.0
    protein_per_100g: float = 0.0
    fat_per_100g: float = 0.0
    carbs_per_100g: float = 0.0
    sodium_per_100g: float = 0.0
    fiber_per_100g: float = 0.0
    dietary_tags: List[str] = field(default_factory=list)
    description: Optional[str] = None
    
    def get_nutrition_per_weight(self, weight_grams: float) -> Dict[str, float]:
        factor = weight_grams / 100.0
        return {
            "能量": self.energy_per_100g * factor,
            "蛋白质": self.protein_per_100g * factor,
            "脂肪": self.fat_per_100g * factor,
            "碳水化合物": self.carbs_per_100g * factor,
            "钠": self.sodium_per_100g * factor,
            "膳食纤维": self.fiber_per_100g * factor
        }


@dataclass
class OrderRecord:
    elderly_id: str
    date: date
    meal_type: str
    dish_code: str
    planned_weight: float
    order_id: Optional[str] = None
    order_status: str = "已确认"
    notes: Optional[str] = None


@dataclass
class ServingRecord:
    elderly_id: str
    date: date
    meal_type: str
    dish_code: str
    actual_weight: float
    serving_id: Optional[str] = None
    serving_time: Optional[datetime] = None
    operator: Optional[str] = None
    is_manual: bool = False
    correction_reason: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class WasteRecord:
    elderly_id: str
    date: date
    meal_type: str
    dish_code: str
    waste_weight: float
    waste_id: Optional[str] = None
    collection_time: Optional[datetime] = None
    collector: Optional[str] = None
    waste_reason: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ValidationError:
    error_id: str
    row_number: int
    error_type: str
    error_message: str
    data_source: str
    column_name: Optional[str] = None
    severity: str = "错误"
    field_value: Optional[str] = None
    suggestion: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DailySummary:
    date: date
    meal_type: str
    total_orders: int
    total_elderly: int
    total_dishes: int
    total_planned_weight: float
    total_actual_weight: float
    total_waste_weight: float
    waste_rate: float
    avg_nutrition: Dict[str, float] = field(default_factory=dict)
    chronic_breakdown: Dict[str, int] = field(default_factory=dict)


@dataclass
class NutritionAnalysis:
    elderly_id: str
    period_start: date
    period_end: date
    total_days: int
    chronic_diseases: List[str] = field(default_factory=list)
    avg_daily_nutrition: Dict[str, float] = field(default_factory=dict)
    daily_reference: Dict[str, float] = field(default_factory=dict)
    deviation_percent: Dict[str, float] = field(default_factory=dict)
    alerts: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class WasteAnalysis:
    dish_code: str
    dish_name: str
    dish_category: str
    period_start: date
    period_end: date
    total_servings: int
    total_planned: float
    total_actual: float
    total_waste: float
    avg_waste_rate: float
    under_serve_count: int
    under_serve_rate: float
    is_persistent_under: bool = False
    chronic_waste_breakdown: Dict[str, float] = field(default_factory=dict)


@dataclass
class ChronicAnalysis:
    chronic_type: str
    period_start: date
    period_end: date
    total_persons: int
    avg_daily_nutrition: Dict[str, float] = field(default_factory=dict)
    nutrition_deviation: Dict[str, float] = field(default_factory=dict)
    key_concerns: List[str] = field(default_factory=list)
    improvement_suggestions: List[str] = field(default_factory=list)
