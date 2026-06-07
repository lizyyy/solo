from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class RecordSource(str, Enum):
    NORMAL = "正常材料"
    WRONG_STANDARD = "错口径材料"
    SUPPLEMENTARY = "补录材料"
    INTERSECTION_PHOTO = "路口照片"
    RESIDENT_COMPLAINT = "居民投诉"


class RecordStatus(str, Enum):
    PENDING_IMPORT = "待导入"
    IMPORTED = "已导入"
    PENDING_REVIEW_PHOTO = "待审核路口照片"
    PENDING_RESIDENT_REVIEW = "待居民代表复核"
    CONFLICT = "冲突待确认"
    MERGED = "已归并"
    REJECTED = "已驳回"
    SUPPLEMENTED = "已补录"


class PointStatus(str, Enum):
    ACTIVE = "有效"
    TEMPORARY_DETOUR = "施工临时改道"
    OLD_STANDARD = "旧口径"
    MERGED = "已归并"
    INVALID = "无效"


@dataclass
class AuditLog:
    timestamp: datetime
    operator: str
    action: str
    before_status: Optional[str] = None
    after_status: Optional[str] = None
    remark: str = ""


@dataclass
class ConflictEvidence:
    field_name: str
    complaint_value: str
    photo_value: str
    description: str


@dataclass
class MergeRecord:
    record_id: str
    house_number: str
    address: str
    source: RecordSource
    status: RecordStatus
    resident_complaint_id: Optional[str] = None
    intersection_photo_id: Optional[str] = None
    point_id: Optional[str] = None
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    is_temporary_detour: bool = False
    is_old_standard: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    remark: str = ""

    def add_audit_log(self, operator: str, action: str, remark: str = ""):
        log = AuditLog(
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            before_status=self.status.value if self.status else None,
            remark=remark,
        )
        self.audit_logs.append(log)
        self.updated_at = datetime.now()

    def update_status(self, new_status: RecordStatus, operator: str, remark: str = ""):
        old_status = self.status
        self.status = new_status
        self.add_audit_log(
            operator=operator,
            action=f"状态变更: {old_status.value} → {new_status.value}",
            remark=remark,
        )


@dataclass
class Point:
    point_id: str
    house_number: str
    address: str
    status: PointStatus
    source_records: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    remark: str = ""


@dataclass
class MergeSession:
    session_id: str
    name: str
    records: List[MergeRecord] = field(default_factory=list)
    points: List[Point] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    replay_commands: List[str] = field(default_factory=list)

    def add_replay_command(self, cmd: str):
        self.replay_commands.append(f"# [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {cmd}")
