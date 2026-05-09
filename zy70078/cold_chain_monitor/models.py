from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class Order:
    order_id: str
    order_type: str
    min_temp: float
    max_temp: float
    route_id: str


@dataclass
class Stop:
    stop_id: str
    stop_name: str
    arrival_time: datetime
    departure_time: datetime
    is_door_open: bool = False
    door_open_duration_min: int = 0


@dataclass
class Segment:
    segment_id: str
    from_stop: str
    to_stop: str
    compartment: str
    start_time: datetime
    end_time: datetime
    orders: List[str] = field(default_factory=list)


@dataclass
class Route:
    route_id: str
    vehicle_id: str
    compartments: List[str]
    stops: List[Stop]
    segments: List[Segment]
    orders: List[Order]


@dataclass
class SensorReading:
    timestamp: datetime
    compartment: str
    temperature: Optional[float]
    is_missing: bool = False


@dataclass
class SimulationConfig:
    temp_drift_rate: float = 0.1
    door_open_rate: float = 2.0
    cooling_rate: float = -1.5
    max_missing_duration_min: int = 30
    random_seed: int = 42


@dataclass
class RiskResult:
    order_id: str
    route_id: str
    risk_level: str
    total_overtime_min: int
    max_temp_violation: float
    min_temp_violation: float
    triggers: List[str]
    missing_data_count: int
    missing_data_duration_min: int
    recommendations: List[str]
    simulation_timestamp: datetime
    segment_details: List[Dict[str, Any]] = field(default_factory=list)
