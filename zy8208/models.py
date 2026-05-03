from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum
import json


class RiskLevel(Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


class RiskType(Enum):
    ZONE_VIOLATION = "海区违规排放"
    VOLUME_EXCEEDED = "排放量超标"
    SENSOR_GAP = "传感器断采"
    MANUAL_CONFLICT = "人工记录冲突"
    PUMP_STATUS_CONFLICT = "泵阀状态冲突"
    MISSING_SENSOR = "缺失传感器数据"
    TIMEZONE_ISSUE = "跨时区问题"


@dataclass
class VoyagePlan:
    voyage_id: str
    vessel_name: str
    departure_port: str
    departure_time: datetime
    arrival_port: str
    arrival_time: datetime
    waypoints: List[Dict[str, Any]] = field(default_factory=list)
    timezone: str = "UTC"
    
    def to_dict(self) -> Dict:
        return {
            "voyage_id": self.voyage_id,
            "vessel_name": self.vessel_name,
            "departure_port": self.departure_port,
            "departure_time": self.departure_time.isoformat(),
            "arrival_port": self.arrival_port,
            "arrival_time": self.arrival_time.isoformat(),
            "waypoints": self.waypoints,
            "timezone": self.timezone
        }


@dataclass
class SensorReading:
    timestamp: datetime
    tank_id: str
    level: float
    temperature: float
    density: float
    volume: float
    status: str
    timezone: str = "UTC"
    
    def to_dict(self) -> Dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "tank_id": self.tank_id,
            "level": self.level,
            "temperature": self.temperature,
            "density": self.density,
            "volume": self.volume,
            "status": self.status,
            "timezone": self.timezone
        }


@dataclass
class ZoneRule:
    zone_id: str
    zone_name: str
    description: str
    latitude_min: float
    latitude_max: float
    longitude_min: float
    longitude_max: float
    max_discharge_volume: float
    is_prohibited: bool
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    
    def is_in_zone(self, lat: float, lon: float) -> bool:
        return (self.latitude_min <= lat <= self.latitude_max and 
                self.longitude_min <= lon <= self.longitude_max)
    
    def to_dict(self) -> Dict:
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "description": self.description,
            "latitude_min": self.latitude_min,
            "latitude_max": self.latitude_max,
            "longitude_min": self.longitude_min,
            "longitude_max": self.longitude_max,
            "max_discharge_volume": self.max_discharge_volume,
            "is_prohibited": self.is_prohibited,
            "effective_from": self.effective_from.isoformat() if self.effective_from else None,
            "effective_to": self.effective_to.isoformat() if self.effective_to else None
        }


@dataclass
class ManualRecord:
    record_id: str
    timestamp: datetime
    tank_id: str
    operation_type: str
    volume: float
    operator: str
    pump_status: str
    valve_status: str
    notes: str
    timezone: str = "UTC"
    
    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "timestamp": self.timestamp.isoformat(),
            "tank_id": self.tank_id,
            "operation_type": self.operation_type,
            "volume": self.volume,
            "operator": self.operator,
            "pump_status": self.pump_status,
            "valve_status": self.valve_status,
            "notes": self.notes,
            "timezone": self.timezone
        }


@dataclass
class TimelineEvent:
    event_id: str
    timestamp: datetime
    tank_id: str
    event_type: str
    volume_change: float
    volume_before: float
    volume_after: float
    source: str
    details: Dict[str, Any] = field(default_factory=dict)
    timezone: str = "UTC"
    
    def to_dict(self) -> Dict:
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "tank_id": self.tank_id,
            "event_type": self.event_type,
            "volume_change": self.volume_change,
            "volume_before": self.volume_before,
            "volume_after": self.volume_after,
            "source": self.source,
            "details": self.details,
            "timezone": self.timezone
        }


@dataclass
class RiskIssue:
    issue_id: str
    tank_id: str
    risk_type: RiskType
    risk_level: RiskLevel
    timestamp: datetime
    description: str
    affected_volume: float
    location: Dict[str, float]
    source_data: Dict[str, Any]
    is_confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_time: Optional[datetime] = None
    notes: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "issue_id": self.issue_id,
            "tank_id": self.tank_id,
            "risk_type": self.risk_type.value,
            "risk_level": self.risk_level.value,
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
            "affected_volume": self.affected_volume,
            "location": self.location,
            "source_data": self.source_data,
            "is_confirmed": self.is_confirmed,
            "confirmed_by": self.confirmed_by,
            "confirmed_time": self.confirmed_time.isoformat() if self.confirmed_time else None,
            "notes": self.notes
        }


@dataclass
class TankStatus:
    tank_id: str
    current_volume: float
    max_volume: float
    last_update: datetime
    status: str
    history: List[TimelineEvent] = field(default_factory=list)
    issues: List[RiskIssue] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "tank_id": self.tank_id,
            "current_volume": self.current_volume,
            "max_volume": self.max_volume,
            "last_update": self.last_update.isoformat(),
            "status": self.status,
            "history": [e.to_dict() for e in self.history],
            "issues": [i.to_dict() for i in self.issues]
        }


@dataclass
class AnalysisReport:
    report_id: str
    voyage_id: str
    generated_time: datetime
    total_tanks: int
    tanks_with_issues: int
    total_issues: int
    issues_by_type: Dict[str, int]
    issues_by_level: Dict[str, int]
    tanks: Dict[str, TankStatus]
    recommendations: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "report_id": self.report_id,
            "voyage_id": self.voyage_id,
            "generated_time": self.generated_time.isoformat(),
            "total_tanks": self.total_tanks,
            "tanks_with_issues": self.tanks_with_issues,
            "total_issues": self.total_issues,
            "issues_by_type": self.issues_by_type,
            "issues_by_level": self.issues_by_level,
            "tanks": {k: v.to_dict() for k, v in self.tanks.items()},
            "recommendations": self.recommendations
        }
