from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class ComplaintRecord:
    complaint_id: str
    community_name: str
    original_line_number: int
    import_timestamp: str
    gap_count: int = 0
    status: str = "pending_import"
    remark: str = ""
    created_by: str = "system"
    updated_by: str = ""
    updated_at: str = ""
    flags: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ComplaintRecord":
        return cls(**data)


@dataclass
class HistoryEntry:
    history_id: str
    complaint_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: str
    change_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HistoryEntry":
        return cls(**data)

    def format_diff(self) -> str:
        return f"[{self.changed_at}] {self.field_name}: {self.old_value} → {self.new_value} (by {self.changed_by})"
