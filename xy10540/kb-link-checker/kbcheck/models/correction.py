from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime


@dataclass
class Correction:
    correction_id: str
    check_id: str
    link_id: str
    source_doc_id: str
    original_url: str
    corrected_url: Optional[str]
    ignore_reason: Optional[str]
    action: str
    status: str
    operator: str
    before_snapshot: dict
    after_snapshot: Optional[dict]
    corrected_at: datetime

    @classmethod
    def from_dict(cls, data: dict) -> "Correction":
        return cls(
            correction_id=data["correction_id"],
            check_id=data["check_id"],
            link_id=data["link_id"],
            source_doc_id=data["source_doc_id"],
            original_url=data["original_url"],
            corrected_url=data.get("corrected_url"),
            ignore_reason=data.get("ignore_reason"),
            action=data["action"],
            status=data["status"],
            operator=data["operator"],
            before_snapshot=data["before_snapshot"],
            after_snapshot=data.get("after_snapshot"),
            corrected_at=datetime.fromisoformat(data["corrected_at"]),
        )

    def to_dict(self) -> dict:
        return {
            "correction_id": self.correction_id,
            "check_id": self.check_id,
            "link_id": self.link_id,
            "source_doc_id": self.source_doc_id,
            "original_url": self.original_url,
            "corrected_url": self.corrected_url,
            "ignore_reason": self.ignore_reason,
            "action": self.action,
            "status": self.status,
            "operator": self.operator,
            "before_snapshot": self.before_snapshot,
            "after_snapshot": self.after_snapshot,
            "corrected_at": self.corrected_at.isoformat(),
        }
