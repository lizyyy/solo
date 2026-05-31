from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
import uuid


class RecordStatus(str, Enum):
    PENDING = "待确认"
    NORMAL = "正常"
    ABNORMAL = "异常"
    ROLLBACK = "已回滚"
    WITHDRAWN = "已撤回"


class DiffType(str, Enum):
    ADDED = "新增"
    MODIFIED = "修改"
    DELETED = "删除"
    UNCHANGED = "未变"


@dataclass
class ChangeOrder:
    order_id: str
    title: str
    applicant: str
    apply_time: str
    description: str = ""
    source: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DiffRecord:
    record_id: str
    file_path: str
    diff_type: DiffType
    status: RecordStatus
    source: str
    change_order_id: str
    md5_before: Optional[str] = None
    md5_after: Optional[str] = None
    operator: str = ""
    remark: str = ""
    pending_reason: str = ""
    create_time: str = field(default_factory=lambda: datetime.now().isoformat())
    update_time: str = field(default_factory=lambda: datetime.now().isoformat())
    has_path_space: bool = False
    file_mismatch: bool = False
    duplicate_exec: bool = False

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["diff_type"] = self.diff_type.value
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DiffRecord":
        data["diff_type"] = DiffType(data["diff_type"])
        data["status"] = RecordStatus(data["status"])
        return cls(**data)


@dataclass
class OperationLog:
    log_id: str
    record_id: str
    action: str
    operator: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    remark: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ManualConfirm:
    confirm_id: str
    record_id: str
    confirmer: str
    confirm_result: str
    remark: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"
