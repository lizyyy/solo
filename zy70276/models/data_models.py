from dataclasses import dataclass, field
from datetime import datetime, date, time
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid

class RecordStatus(Enum):
    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    SUPPLEMENTED = "supplemented"
    MODIFIED = "modified"
    PENDING_REVIEW = "pending_review"

class SampleQuality(Enum):
    NORMAL = "normal"
    MISSING = "missing"
    SUSPICIOUS = "suspicious"

@dataclass
class TrainInfo:
    train_number: str
    route: str
    departure_station: str
    arrival_station: str
    departure_time: time
    arrival_time: time
    total_capacity: int
    operation_days: List[int] = field(default_factory=lambda: [1, 2, 3, 4, 5, 6, 7])
    train_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])

@dataclass
class MealItem:
    meal_id: str
    name: str
    category: str
    price: float
    shelf_life_hours: int
    recommended_for: List[str] = field(default_factory=list)
    preparation_time_minutes: int = 30

@dataclass
class SalesRecord:
    record_id: str
    train_id: str
    train_number: str
    meal_id: str
    meal_name: str
    date: date
    departure_time: time
    segment: str
    passenger_count: int
    units_sold: int
    initial_stock: int
    was_sold_out: bool
    sold_out_time: Optional[time] = None
    weather_condition: Optional[str] = None
    holiday: Optional[bool] = False
    recorded_at: datetime = field(default_factory=datetime.now)
    recorded_by: str = "system"
    status: RecordStatus = RecordStatus.ACTIVE
    quality: SampleQuality = SampleQuality.NORMAL
    quality_notes: List[str] = field(default_factory=list)
    version: int = 1
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RecordHistory:
    history_id: str
    record_id: str
    action: str
    timestamp: datetime
    actor: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None

@dataclass
class PredictionResult:
    prediction_id: str
    train_id: str
    train_number: str
    meal_id: str
    meal_name: str
    date: date
    departure_time: time
    predicted_demand: float
    recommended_stock: int
    confidence_score: float
    safety_stock: int
    max_stock: int
    min_stock: int
    historical_sell_through_rate: float
    peak_demand_segment: str
    risk_assessment: str
    factors: Dict[str, Any] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.now)

@dataclass
class QualityReport:
    report_id: str
    generated_at: datetime
    total_records: int
    normal_samples: int
    missing_samples: int
    suspicious_samples: int
    missing_details: List[Dict[str, Any]] = field(default_factory=list)
    suspicious_details: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

@dataclass
class ReviewReport:
    report_id: str
    generated_at: datetime
    date_range: tuple
    train_summary: Dict[str, Any] = field(default_factory=dict)
    meal_summary: Dict[str, Any] = field(default_factory=dict)
    quality_summary: Dict[str, Any] = field(default_factory=dict)
    predictions_summary: Dict[str, Any] = field(default_factory=dict)
    action_items: List[Dict[str, Any]] = field(default_factory=list)
    key_insights: List[str] = field(default_factory=list)
