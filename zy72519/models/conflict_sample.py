from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class ConflictType(str, Enum):
    CATEGORY_MISMATCH = "category_mismatch"
    DESENSITIZATION_CONFLICT = "desensitization_conflict"
    LINK_404_PASSED = "link_404_passed"
    CALIBER_ERROR = "caliber_error"
    OTHER = "other"


class ConflictStatus(str, Enum):
    DETECTED = "detected"
    PENDING_CONFIRM = "pending_confirm"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    RESOLVED = "resolved"
    NEED_PRODUCT_REVIEW = "need_product_review"


@dataclass
class ConflictEvidence:
    type: str
    description: str
    source: str
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "description": self.description,
            "source": self.source,
            "details": self.details,
        }


@dataclass
class ConflictSample:
    id: str
    work_order_id: str
    conflict_type: ConflictType
    status: ConflictStatus
    evidence: List[ConflictEvidence] = field(default_factory=list)
    detect_time: datetime = field(default_factory=datetime.now)
    handler: Optional[str] = None
    handle_time: Optional[datetime] = None
    handle_notes: str = ""
    resolution: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "work_order_id": self.work_order_id,
            "conflict_type": self.conflict_type.value,
            "status": self.status.value,
            "evidence": [e.to_dict() for e in self.evidence],
            "detect_time": self.detect_time.isoformat(),
            "handler": self.handler,
            "handle_time": self.handle_time.isoformat() if self.handle_time else None,
            "handle_notes": self.handle_notes,
            "resolution": self.resolution,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ConflictSample":
        return cls(
            id=data["id"],
            work_order_id=data["work_order_id"],
            conflict_type=ConflictType(data["conflict_type"]),
            status=ConflictStatus(data["status"]),
            evidence=[ConflictEvidence(**e) for e in data.get("evidence", [])],
            detect_time=datetime.fromisoformat(data["detect_time"]),
            handler=data.get("handler"),
            handle_time=datetime.fromisoformat(data["handle_time"]) if data.get("handle_time") else None,
            handle_notes=data.get("handle_notes", ""),
            resolution=data.get("resolution"),
        )
