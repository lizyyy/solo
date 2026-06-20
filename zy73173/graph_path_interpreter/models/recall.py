from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class RecallRecord:
    record_id: str
    original_row_id: str
    reason: str
    recalled_by: str
    recalled_at: datetime = field(default_factory=datetime.now)
    is_effective: bool = True
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "original_row_id": self.original_row_id,
            "reason": self.reason,
            "recalled_by": self.recalled_by,
            "recalled_at": self.recalled_at.isoformat(),
            "is_effective": self.is_effective,
            "note": self.note,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RecallRecord":
        return cls(
            record_id=data["record_id"],
            original_row_id=data["original_row_id"],
            reason=data["reason"],
            recalled_by=data["recalled_by"],
            recalled_at=datetime.fromisoformat(data["recalled_at"]),
            is_effective=data.get("is_effective", True),
            note=data.get("note"),
        )
