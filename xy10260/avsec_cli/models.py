from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, List, Dict
import json

def now_str():
    return datetime.now().isoformat()

@dataclass
class AircraftRule:
    aircraft_type: str
    economy_meals: int = 0
    business_meals: int = 0
    first_class_meals: int = 0
    snacks: int = 0
    beverages: int = 0
    cutlery_sets: int = 0
    blankets: int = 0
    pillows: int = 0
    headsets: int = 0
    amenity_kits: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    id: Optional[int] = None

    def to_dict(self):
        d = asdict(self)
        for k, v in list(d.items()):
            if v is None:
                del d[k]
        return d

@dataclass
class SpecialMealType:
    code: str
    description: str
    id: Optional[int] = None
    created_at: Optional[str] = None

@dataclass
class FlightPlan:
    flight_number: str
    aircraft_type: str
    route: str
    scheduled_departure: str
    economy_passengers: int = 0
    business_passengers: int = 0
    first_class_passengers: int = 0
    status: str = "active"
    version: int = 1
    previous_aircraft_type: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    id: Optional[int] = None

    def total_passengers(self):
        return self.economy_passengers + self.business_passengers + self.first_class_passengers

@dataclass
class PassengerSpecialMeal:
    flight_number: str
    meal_code: str
    count: int = 0
    passenger_names: Optional[str] = None
    created_at: Optional[str] = None
    id: Optional[int] = None

@dataclass
class LoadingRecord:
    flight_number: str
    aircraft_type: str
    plan_version: int = 1
    economy_meals_loaded: int = 0
    business_meals_loaded: int = 0
    first_class_meals_loaded: int = 0
    snacks_loaded: int = 0
    beverages_loaded: int = 0
    cutlery_sets_loaded: int = 0
    blankets_loaded: int = 0
    pillows_loaded: int = 0
    headsets_loaded: int = 0
    amenity_kits_loaded: int = 0
    loader_name: Optional[str] = None
    load_time: Optional[str] = None
    status: str = "pending"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    id: Optional[int] = None
    special_meals: List[Dict] = None

    def __post_init__(self):
        if self.special_meals is None:
            self.special_meals = []

@dataclass
class VerificationResult:
    flight_number: str
    check_run_id: str
    check_type: str
    status: str
    details: Optional[str] = None
    created_at: Optional[str] = None
    id: Optional[int] = None

@dataclass
class OperationHistory:
    entity_type: str
    entity_id: str
    operation: str
    operator: str
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    timestamp: Optional[str] = None
    id: Optional[int] = None
