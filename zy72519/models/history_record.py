from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, Dict


class OperationType(str, Enum):
    IMPORT = "import"
    DETECT_CONFLICT = "detect_conflict"
    REVIEW_REMARK = "review_remark"
    CONFIRM_CONFLICT = "confirm_conflict"
    REJECT_CONFLICT = "reject_conflict"
    RESOLVE_CONFLICT = "resolve_conflict"
    SUPPLEMENTARY_IMPORT = "supplementary_import"
    RECALCULATE = "recalculate"
    EXPORT = "export"
    SELF_CHECK = "self_check"


@dataclass
class HistoryRecord:
    id: str
    operation_type: OperationType
    operator: str
    operate_time: datetime
    target_id: str
    target_type: str
    before_state: Optional[Dict] = None
    after_state: Optional[Dict] = None
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "operation_type": self.operation_type.value,
            "operator": self.operator,
            "operate_time": self.operate_time.isoformat(),
            "target_id": self.target_id,
            "target_type": self.target_type,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "HistoryRecord":
        return cls(
            id=data["id"],
            operation_type=OperationType(data["operation_type"]),
            operator=data["operator"],
            operate_time=datetime.fromisoformat(data["operate_time"]),
            target_id=data["target_id"],
            target_type=data["target_type"],
            before_state=data.get("before_state"),
            after_state=data.get("after_state"),
            notes=data.get("notes", ""),
        )
