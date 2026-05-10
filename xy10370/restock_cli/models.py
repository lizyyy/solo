from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class WeatherType(Enum):
    SUNNY = "sunny"
    CLOUDY = "cloudy"
    RAINY = "rainy"
    SNOWY = "snowy"


class ActivityType(Enum):
    NORMAL = "normal"
    PROMOTION = "promotion"
    HOLIDAY = "holiday"


class OrderStatus(Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


@dataclass
class Store:
    store_id: str
    name: str
    address: str = ""


@dataclass
class Ingredient:
    ingredient_id: str
    name: str
    unit: str = "kg"


@dataclass
class SalesRecord:
    date: str
    store_id: str
    ingredient_id: str
    quantity: float


@dataclass
class WeatherRecord:
    date: str
    store_id: str
    weather_type: WeatherType = WeatherType.SUNNY
    temperature: float = 20.0


@dataclass
class StoreActivity:
    date: str
    store_id: str
    activity_type: ActivityType = ActivityType.NORMAL
    impact_factor: float = 1.0


@dataclass
class GroupOrder:
    order_id: str
    date: str
    store_id: str
    ingredient_id: str
    quantity: float
    status: OrderStatus = OrderStatus.CONFIRMED


@dataclass
class RestockSuggestion:
    date: str
    store_id: str
    ingredient_id: str
    base_estimate: float
    weather_adjustment: float
    activity_adjustment: float
    group_order_quantity: float
    suggested_quantity: float
    adjusted_quantity: Optional[float] = None
    adjustment_reason: str = ""


@dataclass
class ActualConsumption:
    date: str
    store_id: str
    ingredient_id: str
    actual_quantity: float
    deviation_reason: str = ""


@dataclass
class DeviationRecord:
    date: str
    store_id: str
    ingredient_id: str
    suggested_quantity: float
    actual_quantity: float
    deviation: float
    deviation_reason: str = ""
