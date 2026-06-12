from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    SMOOTH = "顺利"
    RAMP_PENDING = "待坡道补录"
    RAMP_NO_CHANGE = "坡道补录评分未变"
    NIGHT_SUPPLEMENT = "夜间采样补录"
    PENDING_REVIEW = "待交通协管复核"
    NORMAL = "正常"


class DataSource(str, Enum):
    DAY_FORMAL = "白天正式表"
    NIGHT_SAMPLING = "夜间采样点"
    RAMP_SUPPLEMENT = "坡道补录"
    MANUAL_CORRECTION = "人工修正"
    RERUN = "重跑"


class ChangeType(str, Enum):
    INITIAL = "首次导入"
    RAMP_SUPPLEMENT = "坡道补录"
    NIGHT_SUPPLEMENT = "夜间采样补录"
    MANUAL = "人工修正"
    RERUN = "重跑"
    REVIEW_CONFIRM = "复核通过"


@dataclass
class SamplingPoint:
    id: str
    name: str
    data_source: DataSource
    permeability_rate: float
    has_remarks: bool = False
    remarks: Optional[str] = None
    collected_at: Optional[datetime] = None


@dataclass
class RampRecord:
    id: str
    location: str
    has_ramp: bool
    ramp_slope: Optional[float] = None
    ramp_remarks: Optional[str] = None
    is_incomplete: bool = False


@dataclass
class VersionHistory:
    version: int
    change_type: ChangeType
    operator: str
    change_reason: str
    timestamp: datetime
    score: float
    previous_score: Optional[float]
    status: RecordStatus
    rectification_suggestions: List[str] = field(default_factory=list)
    ramp_remarks: Optional[str] = None
    previous_ramp_remarks: Optional[str] = None
    sampling_point_count: int = 0
    night_sampling_added: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvaluationRecord:
    id: str
    road_name: str
    district: str
    score: float
    previous_score: Optional[float] = None
    status: RecordStatus = RecordStatus.SMOOTH
    sampling_points: List[SamplingPoint] = field(default_factory=list)
    ramp: Optional[RampRecord] = None
    rectification_suggestions: List[str] = field(default_factory=list)
    previous_suggestions: List[str] = field(default_factory=list)
    data_source_notes: Dict[DataSource, str] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    is_rerun: bool = False
    has_manual_correction: bool = False
    review_night_supplemented: bool = False
    version_history: List[VersionHistory] = field(default_factory=list)
    last_operator: str = "系统"
    last_change_reason: str = ""


@dataclass
class ProcessLog:
    record_id: str
    action: str
    timestamp: datetime = field(default_factory=datetime.now)
    operator: str = "系统"
    details: str = ""
