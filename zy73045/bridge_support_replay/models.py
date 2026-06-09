"""数据模型 — 桥梁支座工单回放。

所有模型都使用 dataclass + from_dict/to_dict，保证序列化稳定、
可被值班脚本直接读取。原始数据字段以 ``raw_`` 前缀或单独
``raw_snapshot`` 区块保留，清洗逻辑只追加不覆盖。
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class WorkOrderStatus(str, Enum):
    """工单状态 — 分类查询的枚举。"""

    HANDLED = "handled"                # 已处理
    PENDING_EVIDENCE = "pending_evidence"  # 待补证据
    STUCK = "stuck"                    # 还卡着（需要人工介入）
    CREATED = "created"                # 初始录入


class TimelineEventType(str, Enum):
    """时间线事件类型。"""

    CREATED = "created"
    PHOTO_UPLOADED = "photo_uploaded"
    SPARE_PART_RECORDED = "spare_part_recorded"
    FIRST_CONCLUSION = "first_conclusion"
    SUPPLEMENT = "supplement"           # 补录证据
    REVERSAL = "reversal"               # 结论改判
    ALARM = "alarm"                     # 自动报警
    MANUAL_NOTE = "manual_note"         # 人工备注
    MISMATCH_DETECTED = "mismatch_detected"  # 时间/数据错位
    CLOSED = "closed"


class FailureCode(str, Enum):
    """稳定的失败码，值班脚本用它做分支，不要依赖文字。"""

    NO_ERROR = "no_error"
    PHOTO_TIME_MISMATCH = "photo_time_mismatch"
    SPARE_PART_VERSION_CONFLICT = "spare_part_version_conflict"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    ALARM_NOTE_MISMATCH = "alarm_note_mismatch"  # 报警与人工备注对不上
    MISSING_REQUIRED_FIELD = "missing_required_field"
    REPLAY_INCONSISTENT = "replay_inconsistent"


class PhotoMismatchAction(str, Enum):
    """照片时间错位时，给接手同事的下一步建议。"""

    RE_EXIF = "re_exif"              # 重新读取EXIF时间
    CHECK_CAMERA_CLOCK = "check_camera_clock"  # 检查现场相机/手机时区
    PROVIDE_WITNESS_RECORD = "provide_witness_record"  # 补交在场人记录
    RE_SHOOT_WITH_TIMESTAMP = "re_shoot_with_timestamp"  # 重拍并叠水印时间
    ACCEPT_WITH_NOTE = "accept_with_note"     # 带说明接受偏差<30min
    ESCALATE = "escalate"            # 升级给安全员老唐


@dataclass
class FailureReason:
    """结构化的失败原因，给脚本和人都能读。"""

    code: FailureCode
    message: str
    details: dict[str, Any] = field(default_factory=dict)
    suggested_actions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "code": self.code.value,
            "message": self.message,
            "details": self.details,
            "suggested_actions": list(self.suggested_actions),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "FailureReason":
        return cls(
            code=FailureCode(d["code"]),
            message=d["message"],
            details=dict(d.get("details", {})),
            suggested_actions=list(d.get("suggested_actions", [])),
        )


@dataclass
class SparePart:
    """备件清单条目 — 原始字段永远保留在 raw_entry。

    - name/spec/quantity 是供业务逻辑读的清洗字段
    - raw_entry           是拿到手的原始行，绝不改动
    - cleaned_note        记录清洗时做了什么（例：把「支座」规范为「盆式支座GPZ(Ⅱ)5DX」）
    - source              记录这一条从哪来（例：老唐微信2025-11-03转发的Excel）
    """

    part_id: str
    name: Optional[str] = None
    spec: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    raw_entry: dict[str, Any] = field(default_factory=dict)
    cleaned_note: Optional[str] = None
    source: Optional[str] = None
    version: int = 1                        # 同一part_id的版本
    recorded_at: Optional[str] = None       # ISO8601

    def to_dict(self) -> dict:
        return {
            "part_id": self.part_id,
            "name": self.name,
            "spec": self.spec,
            "quantity": self.quantity,
            "unit": self.unit,
            "raw_entry": dict(self.raw_entry),
            "cleaned_note": self.cleaned_note,
            "source": self.source,
            "version": self.version,
            "recorded_at": self.recorded_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "SparePart":
        return cls(
            part_id=d["part_id"],
            name=d.get("name"),
            spec=d.get("spec"),
            quantity=d.get("quantity"),
            unit=d.get("unit"),
            raw_entry=dict(d.get("raw_entry", {})),
            cleaned_note=d.get("cleaned_note"),
            source=d.get("source"),
            version=int(d.get("version", 1)),
            recorded_at=d.get("recorded_at"),
        )


@dataclass
class PhotoRecord:
    """照片记录。

    - exif_time        从EXIF读出来的时间（原始）
    - claimed_time     备注里写的拍照时间（人工填的）
    - site_time        现场记录/打卡时间
    - upload_time      系统上传时间
    四个时间做错位检测。
    """

    photo_id: str
    file_path: str
    exif_time: Optional[str] = None
    claimed_time: Optional[str] = None
    site_time: Optional[str] = None
    upload_time: Optional[str] = None
    description: Optional[str] = None
    uploaded_by: Optional[str] = None
    camera_tz: Optional[str] = None         # 相机时区，例：Asia/Shanghai
    mismatch_notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "photo_id": self.photo_id,
            "file_path": self.file_path,
            "exif_time": self.exif_time,
            "claimed_time": self.claimed_time,
            "site_time": self.site_time,
            "upload_time": self.upload_time,
            "description": self.description,
            "uploaded_by": self.uploaded_by,
            "camera_tz": self.camera_tz,
            "mismatch_notes": list(self.mismatch_notes),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "PhotoRecord":
        return cls(
            photo_id=d["photo_id"],
            file_path=d["file_path"],
            exif_time=d.get("exif_time"),
            claimed_time=d.get("claimed_time"),
            site_time=d.get("site_time"),
            upload_time=d.get("upload_time"),
            description=d.get("description"),
            uploaded_by=d.get("uploaded_by"),
            camera_tz=d.get("camera_tz"),
            mismatch_notes=list(d.get("mismatch_notes", [])),
        )


@dataclass
class TimelineEvent:
    """时间线事件 — 保证所有变更可回溯。"""

    event_id: str
    event_type: TimelineEventType
    timestamp: str                        # ISO8601
    actor: str                            # 系统 / 人名
    summary: str
    before_snapshot: dict[str, Any] = field(default_factory=dict)  # 改之前
    after_snapshot: dict[str, Any] = field(default_factory=dict)   # 改之后
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "timestamp": self.timestamp,
            "actor": self.actor,
            "summary": self.summary,
            "before_snapshot": dict(self.before_snapshot),
            "after_snapshot": dict(self.after_snapshot),
            "metadata": dict(self.metadata),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "TimelineEvent":
        return cls(
            event_id=d["event_id"],
            event_type=TimelineEventType(d["event_type"]),
            timestamp=d["timestamp"],
            actor=d["actor"],
            summary=d["summary"],
            before_snapshot=dict(d.get("before_snapshot", {})),
            after_snapshot=dict(d.get("after_snapshot", {})),
            metadata=dict(d.get("metadata", {})),
        )


@dataclass
class WorkOrder:
    """桥梁支座工单 — 顶层实体。"""

    workorder_id: str
    title: str
    bridge_name: str
    support_position: str
    status: WorkOrderStatus = WorkOrderStatus.CREATED
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = None
    current_conclusion: Optional[str] = None           # 当前结论
    current_note: Optional[str] = None                 # 当前人工备注
    alarm_status: Optional[str] = None                 # 报警状态（供备注对不上检查）
    spare_parts: list[SparePart] = field(default_factory=list)
    photos: list[PhotoRecord] = field(default_factory=list)
    timeline: list[TimelineEvent] = field(default_factory=list)

    # 原始数据快照 — 从外部系统拿到的第一手JSON/Excel行
    # 永远不要改这个字段，只追加更高层的结构化字段
    raw_snapshot: dict[str, Any] = field(default_factory=dict)
    raw_snapshot_source: Optional[str] = None   # 例："养护系统API 2025-11-03T10:21导出"
    cleaning_log: list[dict[str, Any]] = field(default_factory=list)  # 清洗痕迹

    # 结论变更历史（第一次结论 vs 每次补录/改判）
    conclusion_history: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "workorder_id": self.workorder_id,
            "title": self.title,
            "bridge_name": self.bridge_name,
            "support_position": self.support_position,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "created_by": self.created_by,
            "current_conclusion": self.current_conclusion,
            "current_note": self.current_note,
            "alarm_status": self.alarm_status,
            "spare_parts": [p.to_dict() for p in self.spare_parts],
            "photos": [p.to_dict() for p in self.photos],
            "timeline": [e.to_dict() for e in self.timeline],
            "raw_snapshot": dict(self.raw_snapshot),
            "raw_snapshot_source": self.raw_snapshot_source,
            "cleaning_log": [dict(x) for x in self.cleaning_log],
            "conclusion_history": [dict(x) for x in self.conclusion_history],
        }

    @classmethod
    def from_dict(cls, d: dict) -> "WorkOrder":
        return cls(
            workorder_id=d["workorder_id"],
            title=d["title"],
            bridge_name=d["bridge_name"],
            support_position=d["support_position"],
            status=WorkOrderStatus(d.get("status", "created")),
            created_at=d.get("created_at"),
            updated_at=d.get("updated_at"),
            created_by=d.get("created_by"),
            current_conclusion=d.get("current_conclusion"),
            current_note=d.get("current_note"),
            alarm_status=d.get("alarm_status"),
            spare_parts=[SparePart.from_dict(x) for x in d.get("spare_parts", [])],
            photos=[PhotoRecord.from_dict(x) for x in d.get("photos", [])],
            timeline=[TimelineEvent.from_dict(x) for x in d.get("timeline", [])],
            raw_snapshot=dict(d.get("raw_snapshot", {})),
            raw_snapshot_source=d.get("raw_snapshot_source"),
            cleaning_log=[dict(x) for x in d.get("cleaning_log", [])],
            conclusion_history=[dict(x) for x in d.get("conclusion_history", [])],
        )


@dataclass
class ReplayResult:
    """replay_workorder 的返回值 — 稳定结构，值班脚本直接按 key 取。"""

    workorder_id: str
    status: WorkOrderStatus
    success: bool
    failure_reason: Optional[FailureReason] = None
    timeline: list[TimelineEvent] = field(default_factory=list)
    spare_parts_analysis: dict[str, Any] = field(default_factory=dict)
    photo_analysis: dict[str, Any] = field(default_factory=dict)
    raw_snapshot: dict[str, Any] = field(default_factory=dict)
    current_conclusion: Optional[str] = None
    suggested_next_step: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "workorder_id": self.workorder_id,
            "status": self.status.value,
            "success": self.success,
            "failure_reason": self.failure_reason.to_dict() if self.failure_reason else None,
            "timeline": [e.to_dict() for e in self.timeline],
            "spare_parts_analysis": dict(self.spare_parts_analysis),
            "photo_analysis": dict(self.photo_analysis),
            "raw_snapshot": dict(self.raw_snapshot),
            "current_conclusion": self.current_conclusion,
            "suggested_next_step": self.suggested_next_step,
        }


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")
