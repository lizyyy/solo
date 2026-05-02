"""
数据模型定义
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional
from datetime import datetime, timedelta


class FabricType(Enum):
    COTTON = "cotton"
    WOOL = "wool"
    SILK = "silk"
    LINEN = "linen"
    POLYESTER = "polyester"
    NYLON = "nylon"
    DENIM = "denim"
    SWEATER = "sweater"


@dataclass
class ClothingItem:
    name: str
    fabric_type: FabricType
    weight_kg: float
    moisture_content_pct: float
    drying_location: str
    hanger_spacing_cm: float
    custom_drying_rate: Optional[float] = None
    estimated_dry_time: Optional[timedelta] = None
    dry_curve: List[Dict] = field(default_factory=list)


@dataclass
class WeatherHour:
    hour: int
    temperature_c: float
    humidity_pct: float
    wind_speed_kph: float
    is_sunny: bool
    uv_index: float = 0.0


@dataclass
class WeatherPeriod:
    start_hour: int
    duration_hours: int
    temperature_c: float
    humidity_pct: float
    wind_speed_kph: float
    is_sunny: bool
    uv_index: float = 0.0


@dataclass
class DryingScenario:
    name: str
    description: str
    start_time: datetime
    clothing_items: List[ClothingItem]
    weather_periods: List[WeatherPeriod]
    average_temp_c: float
    average_humidity_pct: float
    average_wind_kph: float


@dataclass
class RiskAssessment:
    clothing_name: str
    mold_risk_score: float
    damp_risk_score: float
    risk_level: str
    warning_messages: List[str]
    critical_hours: List[int]


@dataclass
class DryingResult:
    scenario_name: str
    total_dry_time_hours: float
    average_dry_time_hours: float
    quickest_item: Dict
    slowest_item: Dict
    risk_assessments: List[RiskAssessment]
    overall_risk_level: str
    recommendations: List[str]
    weather_summary: Dict
    raw_data: Dict


@dataclass
class ComparisonResult:
    scenario_a_name: str
    scenario_b_name: str
    winner: str
    time_savings_hours: float
    risk_comparison: Dict
    key_differences: List[str]
    detailed_comparison: Dict
