from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


class RecordStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING_CONFIRM = "pending_confirm"
    CONFIRMED = "confirmed"
    ARCHIVED = "archived"


class Conclusion(str, Enum):
    SCHEME_A = "方案A（粘钢加固）"
    SCHEME_B = "方案B（碳纤维布加固）"
    SCHEME_C = "方案C（增大截面）"
    NEEDS_INSPECTION = "需进一步检测"
    REJECTED = "不通过"


class OperationType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    SUPPLEMENT = "supplement"
    SUSPEND = "suspend"
    CONFIRM = "confirm"
    REVISE_CONCLUSION = "revise_conclusion"
    EXPORT = "export"


@dataclass
class ViewPoint:
    """视角参数：保证截图、场景标注、接口返回使用同一视角定义"""
    camera_position: Dict[str, float]
    camera_target: Dict[str, float]
    camera_up: Dict[str, float] = field(default_factory=lambda: {"x": 0, "y": 0, "z": 1})
    zoom: float = 1.0
    fov: float = 45.0

    def fingerprint(self) -> str:
        keys = sorted(self.camera_position.keys())
        vp = "|".join(f"{k}:{round(self.camera_position[k], 4)}" for k in keys)
        vt = "|".join(f"{k}:{round(self.camera_target[k], 4)}" for k in keys)
        return f"VP:{vp}||VT:{vt}||Z:{self.zoom}||F:{self.fov}"


@dataclass
class CollisionPoint:
    """碰撞点：截图与视角绑定，确保换视角后可追溯"""
    collision_id: str = field(default_factory=lambda: _new_id("COL"))
    element_id: str = ""
    description: str = ""
    screenshot_path: str = ""
    viewpoint: ViewPoint = field(default_factory=ViewPoint)
    severity: str = "medium"
    detected_at: str = field(default_factory=_now)
    supplement_note: Optional[str] = None
    historical_screenshots: List[Dict[str, Any]] = field(default_factory=list)

    def dedup_key(self) -> str:
        return f"{self.element_id}|{self.viewpoint.fingerprint()}|{self.description.strip()}"


@dataclass
class MaterialReviewItem:
    """材料送审表单条记录"""
    item_id: str = field(default_factory=lambda: _new_id("MAT"))
    material_name: str = ""
    specification: str = ""
    supplier: str = ""
    batch_no: str = ""
    quantity: float = 0.0
    unit: str = ""
    collision_points: List[CollisionPoint] = field(default_factory=list)
    remarks: List[Dict[str, str]] = field(default_factory=list)
    created_at: str = field(default_factory=_now)
    created_by: str = ""

    def add_remark(self, content: str, operator: str) -> None:
        self.remarks.append({
            "content": content,
            "operator": operator,
            "timestamp": _now(),
        })


@dataclass
class HistoryVersion:
    """历史版本快照：保留旧材料、新备注、改判原因"""
    version_id: str = field(default_factory=lambda: _new_id("HIS"))
    version_no: int = 1
    parent_id: Optional[str] = None
    snapshot_material: Optional[Dict[str, Any]] = None
    new_remarks: List[Dict[str, str]] = field(default_factory=list)
    old_conclusion: Optional[Conclusion] = None
    new_conclusion: Optional[Conclusion] = None
    revise_reason: str = ""
    operator: str = ""
    operated_at: str = field(default_factory=_now)
    affected_conclusion_ids: List[str] = field(default_factory=list)


@dataclass
class AuditLog:
    """操作审计日志：跨班次追溯"""
    log_id: str = field(default_factory=lambda: _new_id("LOG"))
    record_id: str = ""
    operator: str = ""
    operation_type: OperationType = OperationType.CREATE
    operation_detail: str = ""
    timestamp: str = field(default_factory=_now)
    field_changes: Dict[str, Dict[str, Any]] = field(default_factory=dict)


@dataclass
class PendingConfirmItem:
    """待确认队列项：重复碰撞点挂起后进入"""
    pending_id: str = field(default_factory=lambda: _new_id("PND"))
    record_id: str = ""
    material_item_id: str = ""
    duplicate_collision_ids: List[str] = field(default_factory=list)
    impact_analysis: str = ""
    affected_conclusions: List[str] = field(default_factory=list)
    suspended_at: str = field(default_factory=_now)
    suspended_by: str = ""
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution: Optional[str] = None


@dataclass
class SchemeComparisonRecord:
    """结构加固方案比选主记录"""
    record_id: str = field(default_factory=lambda: _new_id("SCM"))
    project_name: str = ""
    project_code: str = ""
    structural_element: str = ""
    status: RecordStatus = RecordStatus.ACTIVE
    conclusion: Optional[Conclusion] = None
    confidence: float = 0.0
    materials: List[MaterialReviewItem] = field(default_factory=list)
    history_chain: List[HistoryVersion] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    pending_queue: List[PendingConfirmItem] = field(default_factory=list)
    scene_annotations: str = ""
    side_notes: str = ""
    api_response: Dict[str, Any] = field(default_factory=dict)
    render_source_id: str = ""
    created_at: str = field(default_factory=_now)
    created_by: str = ""
    updated_at: str = field(default_factory=_now)
    current_version: int = 1
