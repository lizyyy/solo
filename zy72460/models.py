from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class PointStatus(str, Enum):
    NORMAL = "正常"
    BOUNDARY = "街道边界待复核"
    CONFLICT = "数据冲突待确认"
    RESOLVED = "已处理"


class RecordSource(str, Enum):
    RAMP_SURVEY = "无障碍坡道普查"
    NIGHT_SAMPLING = "夜间采样补录"
    MANUAL_REVIEW = "人工复核"


class ConflictResolution(str, Enum):
    PENDING = "待确认"
    CONFIRMED = "巡检员确认"
    REJECTED = "巡检员驳回"
    MANAGER_APPROVED = "项目经理批准"


@dataclass
class GeoPoint:
    lat: float
    lng: float
    street: str
    is_boundary: bool = False
    adjacent_streets: List[str] = field(default_factory=list)


@dataclass
class InspectionPoint:
    point_id: str
    name: str
    location: GeoPoint
    point_type: str = "雨水花园"


@dataclass
class InspectionRecord:
    record_id: str
    point_id: str
    source: RecordSource
    inspector: str
    inspect_time: datetime
    has_waterlogging: bool
    water_depth_cm: Optional[float] = None
    ramp_accessible: Optional[bool] = None
    ramp_note: Optional[str] = None
    remarks: Optional[str] = None
    import_time: datetime = field(default_factory=datetime.now)
    is_supplementary: bool = False


@dataclass
class ConflictItem:
    conflict_id: str
    point_id: str
    field_name: str
    ramp_record_value: Any
    night_sampling_value: Any
    ramp_record_id: str
    night_sampling_id: str
    resolution: ConflictResolution = ConflictResolution.PENDING
    resolved_by: Optional[str] = None
    resolved_time: Optional[datetime] = None


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MapExport:
    export_id: str
    export_time: datetime
    exported_by: str
    point_count: int
    boundary_points: List[str]
    conflict_points: List[str]
    file_hash: str


@dataclass
class ReviewSession:
    session_id: str
    task_name: str = "雨水花园积水复核"
    created_at: datetime = field(default_factory=datetime.now)
    inspection_points: Dict[str, InspectionPoint] = field(default_factory=dict)
    records: List[InspectionRecord] = field(default_factory=list)
    conflicts: List[ConflictItem] = field(default_factory=list)
    self_check_results: List[SelfCheckResult] = field(default_factory=list)
    export_history: List[MapExport] = field(default_factory=list)
    current_step: int = 1
