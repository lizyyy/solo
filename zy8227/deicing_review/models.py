from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any


class FluidType(Enum):
    TYPE_I = "TYPE_I"
    TYPE_II = "TYPE_II"
    TYPE_IV = "TYPE_IV"
    UNKNOWN = "UNKNOWN"


class IssueSeverity(Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class IssueType(Enum):
    HOLD_TIME_EXPIRED = "HOLD_TIME_EXPIRED"
    MISSING_FLUID_TYPE = "MISSING_FLUID_TYPE"
    MISSING_BATCH_INFO = "MISSING_BATCH_INFO"
    CROSS_MIDNIGHT_FLIGHT = "CROSS_MIDNIGHT_FLIGHT"
    INSUFFICIENT_HOLD_TIME = "INSUFFICIENT_HOLD_TIME"
    FLUID_CONFLICT = "FLUID_CONFLICT"
    PRECIPITATION_RISK = "PRECIPITATION_RISK"
    TEMPERATURE_OUT_OF_RANGE = "TEMPERATURE_OUT_OF_RANGE"


@dataclass
class FlightPlan:
    flight_number: str
    aircraft_registration: str
    departure_runway: str
    scheduled_departure_time: datetime
    actual_departure_time: Optional[datetime] = None
    gate: str = ""
    aircraft_type: str = ""
    is_cross_midnight: bool = False

    def __post_init__(self):
        if self.scheduled_departure_time:
            base = self.scheduled_departure_time
            next_day = base + timedelta(days=1)
            if base.hour >= 22 or base.hour < 4:
                self.is_cross_midnight = True


@dataclass
class WeatherData:
    timestamp: datetime
    runway: str
    temperature: float
    dew_point: float
    wind_speed: float
    wind_direction: int
    precipitation: str
    visibility: float
    relative_humidity: float = field(init=False)

    def __post_init__(self):
        if self.temperature and self.dew_point:
            self.relative_humidity = self._calculate_rh()
        else:
            self.relative_humidity = 0.0

    def _calculate_rh(self) -> float:
        T = self.temperature
        Td = self.dew_point
        es = 6.11 * 10 ** (7.5 * T / (237.7 + T))
        e = 6.11 * 10 ** (7.5 * Td / (237.7 + Td))
        return min(100.0, (e / es) * 100) if es > 0 else 0.0

    def has_active_precipitation(self) -> bool:
        precip = self.precipitation.lower()
        return any(p in precip for p in ['rain', 'snow', 'sleet', 'drizzle', 'freezing'])


@dataclass
class FluidBatch:
    batch_id: str
    fluid_type: FluidType
    manufacturer: str
    concentration: float
    production_date: datetime
    expiry_date: datetime
    min_hold_time_minutes: Dict[int, int] = field(default_factory=dict)
    max_hold_time_minutes: Dict[int, int] = field(default_factory=dict)

    def get_hold_time_range(self, temperature: float) -> tuple[int, int]:
        temp = int(round(temperature))
        if temp in self.min_hold_time_minutes and temp in self.max_hold_time_minutes:
            return (self.min_hold_time_minutes[temp], self.max_hold_time_minutes[temp])
        
        keys = sorted(self.min_hold_time_minutes.keys())
        if not keys:
            return (0, 0)
        
        if temp < keys[0]:
            return (self.min_hold_time_minutes[keys[0]], self.max_hold_time_minutes[keys[0]])
        if temp > keys[-1]:
            return (self.min_hold_time_minutes[keys[-1]], self.max_hold_time_minutes[keys[-1]])
        
        for i in range(len(keys) - 1):
            if keys[i] <= temp <= keys[i + 1]:
                t1, t2 = keys[i], keys[i + 1]
                ratio = (temp - t1) / (t2 - t1) if t2 != t1 else 0
                min_ht = int(self.min_hold_time_minutes[t1] + ratio * (self.min_hold_time_minutes[t2] - self.min_hold_time_minutes[t1]))
                max_ht = int(self.max_hold_time_minutes[t1] + ratio * (self.max_hold_time_minutes[t2] - self.max_hold_time_minutes[t1]))
                return (min_ht, max_ht)
        
        return (0, 0)

    def is_valid(self, check_date: datetime) -> bool:
        return self.production_date <= check_date <= self.expiry_date


@dataclass
class SprayRecord:
    record_id: str
    aircraft_registration: str
    spray_time: datetime
    runway: str
    gate: str
    fluid_batch_id: str
    fluid_type: Optional[FluidType] = None
    fluid_volume: float = 0.0
    spray_duration_seconds: int = 0
    operator: str = ""
    notes: str = ""
    fluid_batch: Optional[FluidBatch] = None


@dataclass
class ReleaseWindow:
    flight_number: str
    aircraft_registration: str
    runway: str
    spray_time: datetime
    scheduled_departure: datetime
    hold_start_time: datetime
    hold_end_time_min: datetime
    hold_end_time_max: datetime
    fluid_type: FluidType
    batch_id: str
    temperature_at_spray: float
    precipitation_status: str

    def is_within_window(self, departure_time: datetime) -> tuple[bool, str]:
        if departure_time < self.hold_start_time:
            return (False, "DEPARTURE_BEFORE_SPRAY")
        if departure_time > self.hold_end_time_max:
            return (False, "HOLD_TIME_EXPIRED")
        if departure_time > self.hold_end_time_min:
            return (True, "WITHIN_EXTENDED_WINDOW")
        return (True, "WITHIN_PRIMARY_WINDOW")

    def get_remaining_hold_time(self, current_time: datetime) -> timedelta:
        if current_time > self.hold_end_time_max:
            return timedelta(0)
        return self.hold_end_time_max - current_time


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    flight_number: str
    aircraft_registration: str
    runway: str
    timestamp: datetime
    description: str
    recommendation: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_csv_row(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "flight_number": self.flight_number,
            "aircraft_registration": self.aircraft_registration,
            "runway": self.runway,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S") if self.timestamp else "",
            "description": self.description,
            "recommendation": self.recommendation,
            "metadata": str(self.metadata)
        }
