import json
import os
from dataclasses import dataclass, field, asdict
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


class AuditActionType(str, Enum):
    IMPORT = "导入"
    CONFLICT_DETECTED = "冲突发现"
    CONFLICT_RESOLVED = "冲突处理"
    SUPPLEMENTARY_REVIEW = "补录回看"
    MAP_EXPORT = "地图导出"
    SELF_CHECK = "自检"


class ImportStatus(str, Enum):
    NEW = "真新增"
    REUSED = "复用已有"


@dataclass
class GeoPoint:
    lat: float
    lng: float
    street: str
    is_boundary: bool = False
    adjacent_streets: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "lat": self.lat,
            "lng": self.lng,
            "street": self.street,
            "is_boundary": self.is_boundary,
            "adjacent_streets": self.adjacent_streets,
        }


@dataclass
class InspectionPoint:
    point_id: str
    name: str
    location: GeoPoint
    point_type: str = "雨水花园"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "point_id": self.point_id,
            "name": self.name,
            "location": self.location.to_dict(),
            "point_type": self.point_type,
        }


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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "point_id": self.point_id,
            "source": self.source.value,
            "inspector": self.inspector,
            "inspect_time": self.inspect_time.isoformat(),
            "has_waterlogging": self.has_waterlogging,
            "water_depth_cm": self.water_depth_cm,
            "ramp_accessible": self.ramp_accessible,
            "ramp_note": self.ramp_note,
            "remarks": self.remarks,
            "import_time": self.import_time.isoformat(),
            "is_supplementary": self.is_supplementary,
        }


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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "point_id": self.point_id,
            "field_name": self.field_name,
            "ramp_record_value": self.ramp_record_value,
            "night_sampling_value": self.night_sampling_value,
            "ramp_record_id": self.ramp_record_id,
            "night_sampling_id": self.night_sampling_id,
            "resolution": self.resolution.value,
            "resolved_by": self.resolved_by,
            "resolved_time": self.resolved_time.isoformat() if self.resolved_time else None,
        }


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "check_name": self.check_name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
        }


@dataclass
class MapExport:
    export_id: str
    export_time: datetime
    exported_by: str
    point_count: int
    boundary_points: List[str]
    conflict_points: List[str]
    file_hash: str
    records_snapshot: List[Dict[str, Any]] = field(default_factory=list)
    conflicts_snapshot: List[Dict[str, Any]] = field(default_factory=list)
    audit_snapshot: List[Dict[str, Any]] = field(default_factory=list)
    file_path: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "export_id": self.export_id,
            "export_time": self.export_time.isoformat(),
            "exported_by": self.exported_by,
            "point_count": self.point_count,
            "boundary_points": self.boundary_points,
            "conflict_points": self.conflict_points,
            "file_hash": self.file_hash,
            "records_snapshot": self.records_snapshot,
            "conflicts_snapshot": self.conflicts_snapshot,
            "audit_snapshot": self.audit_snapshot,
            "file_path": self.file_path,
        }


@dataclass
class ImportDetail:
    record_id: str
    point_id: str
    status: ImportStatus
    existing_record_id: Optional[str] = None
    source_value_preview: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "point_id": self.point_id,
            "status": self.status.value,
            "existing_record_id": self.existing_record_id,
            "source_value_preview": self.source_value_preview,
        }


@dataclass
class AuditEntry:
    audit_id: str
    action_type: AuditActionType
    actor: str
    timestamp: datetime
    description: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    related_record_ids: List[str] = field(default_factory=list)
    related_conflict_ids: List[str] = field(default_factory=list)
    related_export_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "audit_id": self.audit_id,
            "action_type": self.action_type.value,
            "actor": self.actor,
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "related_record_ids": self.related_record_ids,
            "related_conflict_ids": self.related_conflict_ids,
            "related_export_id": self.related_export_id,
        }


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
    audit_log: List[AuditEntry] = field(default_factory=list)
    current_step: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "task_name": self.task_name,
            "created_at": self.created_at.isoformat(),
            "inspection_points": {k: v.to_dict() for k, v in self.inspection_points.items()},
            "records": [r.to_dict() for r in self.records],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "self_check_results": [s.to_dict() for s in self.self_check_results],
            "export_history": [e.to_dict() for e in self.export_history],
            "audit_log": [a.to_dict() for a in self.audit_log],
            "current_step": self.current_step,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)
