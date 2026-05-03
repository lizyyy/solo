"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional


class EventType(Enum):
    ALARM = "alarm"
    FAN_START = "fan_start"
    FAN_STOP = "fan_stop"
    DAMPER_OPEN = "damper_open"
    DAMPER_CLOSE = "damper_close"
    SENSOR_READING = "sensor_reading"


class IssueType(Enum):
    MIDNIGHT_EVENT_MISASSIGNMENT = "midnight_event_misassignment"
    FAN_NO_DAMPER = "fan_start_without_damper_open"
    SENSOR_GAP = "sensor_gap"
    MISSING_FIELD = "missing_field"
    INVALID_VALUE = "invalid_value"
    DELAY_EXCEEDED = "delay_exceeded"


@dataclass
class Zone:
    zone_id: str
    zone_name: str
    floor: int
    area: float
    assigned_fans: List[str] = field(default_factory=list)
    assigned_dampers: List[str] = field(default_factory=list)
    sensors: List[str] = field(default_factory=list)


@dataclass
class Fan:
    fan_id: str
    fan_name: str
    rated_flow: float
    max_flow: float
    assigned_zones: List[str] = field(default_factory=list)


@dataclass
class DamperEvent:
    damper_id: str
    event_time: datetime
    event_type: str
    zone_id: Optional[str] = None
    raw_line: Optional[str] = None


@dataclass
class SensorMinute:
    sensor_id: str
    timestamp: datetime
    co2: Optional[float] = None
    smoke: Optional[float] = None
    temp: Optional[float] = None


@dataclass
class TimelineEvent:
    time: datetime
    event_type: EventType
    device_id: str
    device_name: str = ""
    value: Optional[float] = None
    raw_data: dict = field(default_factory=dict)


@dataclass
class ZoneAnalysis:
    zone_id: str
    zone_name: str
    floor: int
    timeline: List[TimelineEvent] = field(default_factory=list)
    start_delay_seconds: Optional[float] = None
    effective_exhaust_volume: Optional[float] = None
    sensor_gaps: List[Dict] = field(default_factory=list)
    issues: List[Dict] = field(default_factory=list)

    def add_issue(self, issue_type: IssueType, description: str, time: Optional[datetime] = None, **kwargs):
        issue = {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "issue_type": issue_type.value,
            "description": description,
            "time": time.isoformat() if time else None,
        }
        issue.update(kwargs)
        self.issues.append(issue)


@dataclass
class ValidationError:
    file_path: str
    line_number: Optional[int]
    issue_type: IssueType
    field_name: Optional[str]
    message: str
    raw_value: Optional[str] = None

    def to_dict(self):
        return {
            "file": self.file_path,
            "line": self.line_number,
            "issue_type": self.issue_type.value,
            "field": self.field_name,
            "message": self.message,
            "raw_value": self.raw_value,
        }
