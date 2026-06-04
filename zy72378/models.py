from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional


class Direction(Enum):
    FORWARD = "正向"
    REVERSE = "负向"
    LEFT_WRITTEN_AS_NEGATIVE = "现场师傅写向左(待复核)"


class ConflictResolution(Enum):
    PENDING = "待教练确认"
    CONFIRMED_BY_COACH = "教练确认采纳"
    REJECTED_BY_COACH = "教练驳回"


class InspectionSource(Enum):
    HANDWRITTEN_NOTE = "手写巡检备注"
    SAFETY_THRESHOLD_TABLE = "安全阈值表"


@dataclass
class WindSpeedRecord:
    record_id: str
    tunnel_id: str
    timestamp: datetime
    wind_speed: float
    pressure_diff: float
    direction: Direction
    source: InspectionSource
    is_supplementary: bool = False
    original_record_id: Optional[str] = None
    inspector_name: str = ""
    remark: str = ""


@dataclass
class SafetyThreshold:
    tunnel_id: str
    max_wind_speed: float
    min_wind_speed: float
    max_pressure_diff: float
    min_pressure_diff: float
    valid_from: datetime
    valid_to: Optional[datetime] = None


@dataclass
class AbnormalCondition:
    record_id: str
    tunnel_id: str
    timestamp: datetime
    issue_type: str
    detail: str
    needs_review: bool = False
    review_status: Optional[str] = None


@dataclass
class ConflictEvidence:
    record_id: str
    handwritten_value: str
    threshold_value: str
    field_name: str
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolved_by: Optional[str] = None
