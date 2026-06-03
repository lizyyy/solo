from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class IssueStatus(Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"


class NextAction(Enum):
    FIELD_TEAM = "找现场班组"
    SURVEY_TEAM = "找航测内业小魏"
    COMPLETED = "已完成"


@dataclass
class PointCloudLog:
    log_id: str
    timestamp: datetime
    operator: str
    action: str
    thinning_ratio: float
    parameters: Dict[str, Any]
    notes: str = ""


@dataclass
class FloorSectionSketch:
    sketch_id: str
    name: str
    import_time: datetime
    importer: str
    floor_number: int
    z_axis_direction: str
    stall_coordinates: List[Dict[str, float]]
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Issue:
    issue_id: str
    type: str
    description: str
    status: IssueStatus
    discovered_at: datetime
    discovered_by: str
    z_axis_inverted: bool = False
    why_kept: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_action: NextAction = NextAction.FIELD_TEAM


@dataclass
class ManualCorrection:
    correction_id: str
    timestamp: datetime
    operator: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str


@dataclass
class ReRunRecord:
    run_id: str
    timestamp: datetime
    operator: str
    reason: str
    affected_results: List[str] = field(default_factory=list)


@dataclass
class PathPlayback:
    playback_id: str
    project_name: str
    sketch: Optional[FloorSectionSketch] = None
    point_cloud_logs: List[PointCloudLog] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    corrections: List[ManualCorrection] = field(default_factory=list)
    re_runs: List[ReRunRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
