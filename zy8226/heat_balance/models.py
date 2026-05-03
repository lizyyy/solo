from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime


class AnomalyType(Enum):
    SENSOR_MISSING = "sensor_missing"
    VALVE_OUT_OF_BOUNDS = "valve_out_of_bounds"
    TEMPERATURE_INVERSION = "temperature_inversion"
    NEGATIVE_FLOW = "negative_flow"


@dataclass
class BuildingUnit:
    unit_id: str
    name: str
    parent_id: Optional[str] = None
    unit_type: str = "apartment"
    design_flow: float = 0.0
    design_heat_load: float = 0.0
    valve_id: Optional[str] = None
    children: List[str] = field(default_factory=list)


@dataclass
class ValveSetting:
    valve_id: str
    unit_id: str
    current_open_rate: float
    min_open_rate: float = 0.0
    max_open_rate: float = 100.0
    is_enabled: bool = True


@dataclass
class SensorReading:
    unit_id: str
    timestamp: datetime
    supply_temp: Optional[float] = None
    return_temp: Optional[float] = None
    flow_rate: Optional[float] = None
    is_valid: bool = True


@dataclass
class WeatherLoadPoint:
    timestamp: datetime
    outdoor_temp: float
    design_load_ratio: float
    ambient_heat_loss_factor: float = 1.0


@dataclass
class TimeSliceResult:
    timestamp: datetime
    unit_id: str
    supply_temp: Optional[float]
    return_temp: Optional[float]
    flow_rate: Optional[float]
    temp_diff: Optional[float]
    resistance_estimate: Optional[float]
    actual_heat_rate: Optional[float]
    required_heat_rate: Optional[float]
    heat_deficit: Optional[float]
    current_valve_open: Optional[float]
    recommended_valve_adjust: Optional[float]
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    is_balanced: bool = True


@dataclass
class AnalysisResult:
    project_name: str
    analysis_time: datetime
    time_slices: List[datetime]
    units: Dict[str, BuildingUnit]
    valves: Dict[str, ValveSetting]
    results: List[TimeSliceResult]
    summary: Dict[str, Any] = field(default_factory=dict)
