from dataclasses import dataclass, field
from datetime import datetime, time, date
from typing import List, Dict, Optional, Any
from enum import Enum


class ZoneType(Enum):
    SWIMMING_LANE = "swimming_lane"
    CHILDREN_AREA = "children_area"
    DEEP_ZONE = "deep_zone"
    SHALLOW_ZONE = "shallow_zone"
    DIVING_AREA = "diving_area"
    REST_AREA = "rest_area"


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IssueType(Enum):
    BLIND_SPOT = "blind_spot"
    FATIGUE_OVERTIME = "fatigue_overtime"
    CHILDREN_AREA_ABSENT = "children_area_absent"
    MISSING_CHECKIN = "missing_checkin"
    CROSS_MIDNIGHT_SHIFT = "cross_midnight_shift"


@dataclass
class Zone:
    id: str
    name: str
    zone_type: ZoneType
    position: Dict[str, float]
    coverage_radius: float
    is_high_risk: bool = False
    min_lifeguards: int = 1


@dataclass
class Layout:
    zones: Dict[str, Zone] = field(default_factory=dict)
    pool_width: float = 0.0
    pool_length: float = 0.0


@dataclass
class Shift:
    id: str
    lifeguard_name: str
    start_time: time
    end_time: time
    assigned_zone_id: str
    is_cross_midnight: bool = False
    date: Optional[date] = None
    
    def get_duration_minutes(self) -> float:
        if self.is_cross_midnight:
            start_dt = datetime.combine(date.today(), self.start_time)
            end_dt = datetime.combine(date.today(), self.end_time)
            if self.end_time < self.start_time:
                end_dt = datetime.combine(date.today(), self.end_time)
                end_dt = end_dt.replace(day=end_dt.day + 1)
            duration = end_dt - start_dt
        else:
            start_dt = datetime.combine(date.today(), self.start_time)
            end_dt = datetime.combine(date.today(), self.end_time)
            duration = end_dt - start_dt
        return duration.total_seconds() / 60


@dataclass
class Schedule:
    shifts: List[Shift] = field(default_factory=list)
    date: Optional[date] = None


@dataclass
class HeatmapPoint:
    timestamp: datetime
    zone_id: str
    visitor_count: int
    density: float


@dataclass
class Heatmap:
    points: List[HeatmapPoint] = field(default_factory=list)


@dataclass
class CheckinRecord:
    timestamp: datetime
    lifeguard_name: str
    zone_id: str
    is_checkin: bool = True


@dataclass
class CheckinLog:
    records: List[CheckinRecord] = field(default_factory=list)


@dataclass
class Rules:
    max_shift_duration_minutes: int = 120
    min_break_minutes: int = 15
    children_area_min_lifeguards: int = 2
    high_risk_zone_min_lifeguards: int = 2
    checkin_grace_minutes: int = 5
    fatigue_alert_threshold_minutes: int = 90
    time_slots: List[Dict[str, str]] = field(default_factory=list)
    
    def get_time_slots(self) -> List[Dict[str, time]]:
        slots = []
        for slot in self.time_slots:
            slots.append({
                "start": datetime.strptime(slot["start"], "%H:%M").time(),
                "end": datetime.strptime(slot["end"], "%H:%M").time()
            })
        return slots


@dataclass
class Issue:
    issue_type: IssueType
    timestamp: Optional[datetime]
    zone_id: Optional[str]
    lifeguard_name: Optional[str]
    description: str
    severity: RiskLevel
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ZoneCoverage:
    zone_id: str
    zone_name: str
    zone_type: ZoneType
    time_slot: str
    assigned_lifeguards: List[str]
    visitor_count: int
    risk_level: RiskLevel
    is_covered: bool
    issues: List[Issue] = field(default_factory=list)


@dataclass
class AnalysisResult:
    time_slots: List[str]
    zone_coverages: Dict[str, List[ZoneCoverage]]
    all_issues: List[Issue]
    summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AppState:
    layout: Optional[Layout] = None
    schedule: Optional[Schedule] = None
    heatmap: Optional[Heatmap] = None
    checkin_log: Optional[CheckinLog] = None
    rules: Optional[Rules] = None
    analysis_result: Optional[AnalysisResult] = None
    is_data_loaded: bool = False
