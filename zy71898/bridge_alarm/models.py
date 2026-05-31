from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


class RecordStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SUPPLEMENT = "supplement"
    REVISED = "revised"
    WITHDRAWN = "withdrawn"

    @classmethod
    def from_str(cls, s: str) -> "RecordStatus":
        mapping = {
            "pending": cls.PENDING,
            "confirmed": cls.CONFIRMED,
            "supplement": cls.SUPPLEMENT,
            "revised": cls.REVISED,
            "withdrawn": cls.WITHDRAWN,
        }
        return mapping.get(s.lower(), cls.PENDING)


STATUS_DISPLAY = {
    RecordStatus.PENDING: "待处理",
    RecordStatus.CONFIRMED: "已确认",
    RecordStatus.SUPPLEMENT: "待补",
    RecordStatus.REVISED: "人工改过",
    RecordStatus.WITHDRAWN: "已撤回",
}


@dataclass
class AlarmRecord:
    id: Optional[int] = None
    source: str = ""
    record_no: str = ""
    bridge_name: str = ""
    position: str = ""
    displacement: float = 0.0
    threshold: float = 0.0
    threshold_level: str = ""
    alarm_time: datetime = field(default_factory=datetime.now)
    status: RecordStatus = RecordStatus.PENDING
    pending_reason: str = ""
    is_manual_modified: bool = False
    operator: str = ""
    remark: str = ""
    vibration_file: str = ""
    team: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @property
    def unique_key(self) -> str:
        return f"{self.source}::{self.record_no}"

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "source": self.source,
            "record_no": self.record_no,
            "bridge_name": self.bridge_name,
            "position": self.position,
            "displacement": self.displacement,
            "threshold": self.threshold,
            "threshold_level": self.threshold_level,
            "alarm_time": self.alarm_time.strftime("%Y-%m-%d %H:%M:%S"),
            "status": self.status.value,
            "status_display": STATUS_DISPLAY[self.status],
            "pending_reason": self.pending_reason,
            "is_manual_modified": self.is_manual_modified,
            "operator": self.operator,
            "remark": self.remark,
            "vibration_file": self.vibration_file,
            "team": self.team,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": self.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
        }


@dataclass
class OperationLog:
    id: Optional[int] = None
    record_id: int = 0
    action: str = ""
    old_status: str = ""
    new_status: str = ""
    operator: str = ""
    reason: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "record_id": self.record_id,
            "action": self.action,
            "old_status": self.old_status,
            "new_status": self.new_status,
            "operator": self.operator,
            "reason": self.reason,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "created_at": self.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }


@dataclass
class ThresholdConfig:
    level: str = ""
    min_value: float = 0.0
    max_value: float = 0.0
    description: str = ""

    def to_dict(self) -> Dict:
        return {
            "level": self.level,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "description": self.description,
        }
