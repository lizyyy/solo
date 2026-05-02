from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Any
from enum import Enum
import json


class RiskLevel(Enum):
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"
    CRITICAL = "极高风险"


class MobilityType(Enum):
    NORMAL = "正常"
    LIMITED = "行动不便"
    WHEELCHAIR = "轮椅"
    BEDRIDDEN = "卧床"


class StationStatus(Enum):
    OPEN = "开放"
    CLOSED = "关闭"
    LOCKED = "锁定"
    FULL = "已满"


@dataclass
class ElderlyPerson:
    id: str
    name: str
    age: int
    gender: str
    address: str
    district: str
    community: str
    latitude: float
    longitude: float
    phone: str
    contact_person: str
    contact_phone: str
    health_conditions: List[str]
    living_alone: bool
    mobility: str
    has_air_conditioning: bool
    needs_special_care: bool
    notes: str = ""
    risk_score: float = 0.0
    risk_level: str = "低风险"
    assigned_station_id: Optional[str] = None
    visit_priority: int = 3
    visited: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "address": self.address,
            "district": self.district,
            "community": self.community,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "phone": self.phone,
            "contact_person": self.contact_person,
            "contact_phone": self.contact_phone,
            "health_conditions": self.health_conditions,
            "living_alone": self.living_alone,
            "mobility": self.mobility,
            "has_air_conditioning": self.has_air_conditioning,
            "needs_special_care": self.needs_special_care,
            "notes": self.notes,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "assigned_station_id": self.assigned_station_id,
            "visit_priority": self.visit_priority,
            "visited": self.visited,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ElderlyPerson":
        return cls(**data)


@dataclass
class CoolingStation:
    id: str
    name: str
    address: str
    district: str
    community: str
    latitude: float
    longitude: float
    capacity: int
    current_occupancy: int = 0
    opening_time: str = "08:00"
    closing_time: str = "18:00"
    facilities: List[str] = field(default_factory=list)
    staff_count: int = 2
    status: str = "开放"
    is_locked: bool = False
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "district": self.district,
            "community": self.community,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "capacity": self.capacity,
            "current_occupancy": self.current_occupancy,
            "opening_time": self.opening_time,
            "closing_time": self.closing_time,
            "facilities": self.facilities,
            "staff_count": self.staff_count,
            "status": self.status,
            "is_locked": self.is_locked,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CoolingStation":
        return cls(**data)

    @property
    def occupancy_rate(self) -> float:
        if self.capacity == 0:
            return 1.0
        return self.current_occupancy / self.capacity

    @property
    def available_spots(self) -> int:
        return max(0, self.capacity - self.current_occupancy)


@dataclass
class HourlyForecast:
    hour: int
    temperature: float
    feels_like: float
    humidity: float
    wind_speed: float
    uv_index: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hour": self.hour,
            "temperature": self.temperature,
            "feels_like": self.feels_like,
            "humidity": self.humidity,
            "wind_speed": self.wind_speed,
            "uv_index": self.uv_index,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HourlyForecast":
        return cls(**data)


@dataclass
class HeatForecast:
    id: str
    forecast_date: date
    district: str
    hourly_forecasts: List[HourlyForecast]
    max_temperature: float
    min_temperature: float
    heat_warning_level: str = "正常"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "forecast_date": self.forecast_date.isoformat(),
            "district": self.district,
            "hourly_forecasts": [hf.to_dict() for hf in self.hourly_forecasts],
            "max_temperature": self.max_temperature,
            "min_temperature": self.min_temperature,
            "heat_warning_level": self.heat_warning_level,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HeatForecast":
        data["forecast_date"] = date.fromisoformat(data["forecast_date"])
        data["hourly_forecasts"] = [
            HourlyForecast.from_dict(hf) for hf in data["hourly_forecasts"]
        ]
        return cls(**data)

    def get_peak_hours(self, threshold: float = 35.0) -> List[int]:
        return [
            hf.hour
            for hf in self.hourly_forecasts
            if hf.feels_like >= threshold
        ]


@dataclass
class TravelTime:
    elderly_id: str
    station_id: str
    walking_minutes: int
    bus_minutes: int
    distance_km: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "elderly_id": self.elderly_id,
            "station_id": self.station_id,
            "walking_minutes": self.walking_minutes,
            "bus_minutes": self.bus_minutes,
            "distance_km": self.distance_km,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TravelTime":
        return cls(**data)


@dataclass
class StationCongestion:
    station_id: str
    hour: int
    estimated_people: int
    congestion_level: str
    capacity_ratio: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "station_id": self.station_id,
            "hour": self.hour,
            "estimated_people": self.estimated_people,
            "congestion_level": self.congestion_level,
            "capacity_ratio": self.capacity_ratio,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StationCongestion":
        return cls(**data)


@dataclass
class VisitSchedule:
    id: str
    elderly_id: str
    scheduled_time: str
    assigned_staff: str
    visit_type: str
    status: str = "待执行"
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "elderly_id": self.elderly_id,
            "scheduled_time": self.scheduled_time,
            "assigned_staff": self.assigned_staff,
            "visit_type": self.visit_type,
            "status": self.status,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VisitSchedule":
        return cls(**data)


@dataclass
class DispatchPlan:
    id: str
    name: str
    created_at: datetime
    forecast_date: date
    district: str
    elderly_ids: List[str]
    station_assignments: Dict[str, str]
    visit_schedules: List[VisitSchedule]
    locked_stations: List[str]
    priority_overrides: Dict[str, int]
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat(),
            "forecast_date": self.forecast_date.isoformat(),
            "district": self.district,
            "elderly_ids": self.elderly_ids,
            "station_assignments": self.station_assignments,
            "visit_schedules": [vs.to_dict() for vs in self.visit_schedules],
            "locked_stations": self.locked_stations,
            "priority_overrides": self.priority_overrides,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DispatchPlan":
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["forecast_date"] = date.fromisoformat(data["forecast_date"])
        data["visit_schedules"] = [
            VisitSchedule.from_dict(vs) for vs in data["visit_schedules"]
        ]
        return cls(**data)


@dataclass
class CoverageGap:
    area_name: str
    district: str
    uncovered_elderly_count: int
    high_risk_count: int
    nearest_station_distance: float
    gap_severity: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "area_name": self.area_name,
            "district": self.district,
            "uncovered_elderly_count": self.uncovered_elderly_count,
            "high_risk_count": self.high_risk_count,
            "nearest_station_distance": self.nearest_station_distance,
            "gap_severity": self.gap_severity,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CoverageGap":
        return cls(**data)
