from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ValveStatus(str, Enum):
    PENDING = "待复核"
    NORMAL = "正常"
    ABNORMAL = "异常"
    BLOCKED = "截图遮挡"
    NEEDS_MORE_INFO = "需补充材料"


class Role(str, Enum):
    PARK_OPERATOR = "园区运维小陶"
    CONSTRUCTION_MANAGER = "施工经理"
    SYSTEM = "系统"
    NEW_STAFF = "新员工"


class NextAction(str, Enum):
    CONTACT_PARK_OPERATOR = "联系园区运维小陶"
    CONTACT_CONSTRUCTION_MANAGER = "联系施工经理"
    SUPPLEMENT_LOGS = "补录点云抽稀日志"
    REVIEW_ON_SITE = "现场复核"
    ARCHIVE = "归档"


class PointCloudLog(BaseModel):
    log_id: str
    timestamp: datetime
    operator: str
    raw_remark: str
    thinning_ratio: Optional[float] = None
    confidence_level: Optional[float] = None
    issues_found: List[str] = Field(default_factory=list)
    original_coordinates: Optional[Dict[str, Any]] = None


class FloorSketch(BaseModel):
    sketch_id: str
    import_time: datetime
    file_name: str
    floor_level: str
    uploaded_by: str
    marked_valve_positions: List[Dict[str, Any]] = Field(default_factory=list)
    has_mobile_screenshot: bool = False


class ChangeRecord(BaseModel):
    change_id: str
    timestamp: datetime
    who: str
    what_changed: str
    why_changed: str
    affected_results: List[str] = Field(default_factory=list)
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None


class SafetyDistanceIssue(BaseModel):
    issue_id: str
    valve_id: str
    valve_label: str
    detected_distance: float
    required_distance: float
    status: ValveStatus
    why_kept: str
    missing_materials: List[str] = Field(default_factory=list)
    next_action: NextAction
    next_action_person: Role
    evidence_photos: List[str] = Field(default_factory=list)
    point_cloud_logs_ref: List[str] = Field(default_factory=list)
    is_blocked_by_screenshot: bool = False


class SafetyDistanceReport(BaseModel):
    report_id: str
    generated_at: datetime
    generated_by: str
    issues: List[SafetyDistanceIssue] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    change_history: List[ChangeRecord] = Field(default_factory=list)


class ValvePositioningRecord(BaseModel):
    record_id: str
    created_at: datetime
    floor_sketch: FloorSketch
    point_cloud_logs: List[PointCloudLog] = Field(default_factory=list)
    safety_report: Optional[SafetyDistanceReport] = None
    change_history: List[ChangeRecord] = Field(default_factory=list)
    status: str = "处理中"
    run_count: int = 1
