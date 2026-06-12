from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class InspectionStatus(str, Enum):
    PENDING = "pending"
    PHOTO_REVIEWED = "photo_reviewed"
    SUGGESTION_UPDATED = "suggestion_updated"
    NEEDS_REVIEW = "needs_review"
    REVIEWED = "reviewed"
    CLOSED = "closed"


class ReviewerRole(str, Enum):
    PLANNER = "planner"
    TRAFFIC_ASSISTANT = "traffic_assistant"


class ChangeType(str, Enum):
    CREATED = "created"
    PHOTO_ADDED = "photo_added"
    REMARK_UPDATED = "remark_updated"
    SCORE_UPDATED = "score_updated"
    SUGGESTION_UPDATED = "suggestion_updated"
    STATUS_CHANGED = "status_changed"
    RAMP_SUPPLEMENTED = "ramp_supplemented"
    REVIEWED = "reviewed"
    ROLLED_BACK = "rolled_back"
    REIMPORT_SKIPPED = "reimport_skipped"


@dataclass
class ResidentComplaint:
    complaint_id: str
    intersection: str
    description: str
    reported_at: datetime
    source: str = "resident"

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["reported_at"] = self.reported_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ResidentComplaint":
        d = d.copy()
        d["reported_at"] = datetime.fromisoformat(d["reported_at"])
        return cls(**d)


@dataclass
class IntersectionPhoto:
    photo_id: str
    complaint_id: str
    file_path: str
    taken_at: datetime
    uploaded_by: str
    remark: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["taken_at"] = self.taken_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "IntersectionPhoto":
        d = d.copy()
        d["taken_at"] = datetime.fromisoformat(d["taken_at"])
        return cls(**d)


@dataclass
class ChangeRecord:
    change_id: str
    inspection_id: str
    change_type: ChangeType
    field_name: Optional[str]
    old_value: Optional[Any]
    new_value: Optional[Any]
    changed_by: str
    changed_at: datetime
    remark: Optional[str] = None
    command_replay: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    old_score: Optional[float] = None
    new_score: Optional[float] = None
    import_batch: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_type"] = self.change_type.value
        d["changed_at"] = self.changed_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ChangeRecord":
        d = d.copy()
        d["change_type"] = ChangeType(d["change_type"])
        d["changed_at"] = datetime.fromisoformat(d["changed_at"])
        return cls(**d)


@dataclass
class RampSupplement:
    ramp_id: str
    inspection_id: str
    location: str
    description: str
    supplemented_by: str
    supplemented_at: datetime
    old_score: Optional[float] = None
    new_score: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["supplemented_at"] = self.supplemented_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RampSupplement":
        d = d.copy()
        d["supplemented_at"] = datetime.fromisoformat(d["supplemented_at"])
        return cls(**d)


@dataclass
class TreePoolInspection:
    inspection_id: str
    complaint_id: str
    complaint: ResidentComplaint
    status: InspectionStatus
    score: Optional[float] = None
    remark: Optional[str] = None
    photos: List[IntersectionPhoto] = field(default_factory=list)
    suggestion: Optional[str] = None
    ramp_supplements: List[RampSupplement] = field(default_factory=list)
    history: List[ChangeRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    assigned_to: Optional[str] = None
    reviewed_by: Optional[str] = None
    import_batch: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        d["complaint"] = self.complaint.to_dict()
        d["photos"] = [p.to_dict() for p in self.photos]
        d["ramp_supplements"] = [r.to_dict() for r in self.ramp_supplements]
        d["history"] = [h.to_dict() for h in self.history]
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TreePoolInspection":
        d = d.copy()
        d["status"] = InspectionStatus(d["status"])
        d["complaint"] = ResidentComplaint.from_dict(d["complaint"])
        d["photos"] = [IntersectionPhoto.from_dict(p) for p in d["photos"]]
        d["ramp_supplements"] = [RampSupplement.from_dict(r) for r in d["ramp_supplements"]]
        d["history"] = [ChangeRecord.from_dict(h) for h in d["history"]]
        d["created_at"] = datetime.fromisoformat(d["created_at"])
        d["updated_at"] = datetime.fromisoformat(d["updated_at"])
        return cls(**d)

    def has_ramp_score_unchanged(self) -> bool:
        for ramp in self.ramp_supplements:
            if ramp.old_score is not None and ramp.new_score is not None:
                if abs(ramp.old_score - ramp.new_score) < 0.001:
                    return True
        return False

    def get_latest_change(self) -> Optional[ChangeRecord]:
        if not self.history:
            return None
        return sorted(self.history, key=lambda h: h.changed_at, reverse=True)[0]


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"
