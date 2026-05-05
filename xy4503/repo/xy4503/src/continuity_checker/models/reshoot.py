from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class ReshootPriority(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReshootStatus(Enum):
    PENDING = "pending"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class ReshootRequirement:
    reshoot_id: str
    original_shot_id: str = ""
    scene_number: str = ""
    shot_number: str = ""
    priority: ReshootPriority = ReshootPriority.MEDIUM
    status: ReshootStatus = ReshootStatus.PENDING
    reason: str = ""
    reason_category: str = ""
    actors_needed: List[str] = field(default_factory=list)
    wardrobe_needed: List[str] = field(default_factory=list)
    props_needed: List[str] = field(default_factory=list)
    makeup_notes: str = ""
    hair_notes: str = ""
    special_requirements: List[str] = field(default_factory=list)
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None
    estimated_duration: Optional[int] = None
    actual_date: Optional[date] = None
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def schedule(self, scheduled_date: date, scheduled_time: time = None, estimated_duration: int = None):
        self.status = ReshootStatus.SCHEDULED
        self.scheduled_date = scheduled_date
        self.scheduled_time = scheduled_time
        self.estimated_duration = estimated_duration
        self.updated_at = datetime.now()
    
    def complete(self, actual_date: date = None):
        self.status = ReshootStatus.COMPLETED
        self.actual_date = actual_date or date.today()
        self.updated_at = datetime.now()
    
    def cancel(self, reason: str = ""):
        self.status = ReshootStatus.CANCELLED
        if reason:
            self.notes = (self.notes + "\n" if self.notes else "") + f"取消原因: {reason}"
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reshoot_id": self.reshoot_id,
            "original_shot_id": self.original_shot_id,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "priority": self.priority.value,
            "status": self.status.value,
            "reason": self.reason,
            "reason_category": self.reason_category,
            "actors_needed": self.actors_needed,
            "wardrobe_needed": self.wardrobe_needed,
            "props_needed": self.props_needed,
            "makeup_notes": self.makeup_notes,
            "hair_notes": self.hair_notes,
            "special_requirements": self.special_requirements,
            "scheduled_date": self.scheduled_date.isoformat() if self.scheduled_date else None,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None,
            "estimated_duration": self.estimated_duration,
            "actual_date": self.actual_date.isoformat() if self.actual_date else None,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReshootRequirement':
        return cls(
            reshoot_id=data["reshoot_id"],
            original_shot_id=data.get("original_shot_id", ""),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            priority=ReshootPriority(data.get("priority", "medium")),
            status=ReshootStatus(data.get("status", "pending")),
            reason=data.get("reason", ""),
            reason_category=data.get("reason_category", ""),
            actors_needed=data.get("actors_needed", []),
            wardrobe_needed=data.get("wardrobe_needed", []),
            props_needed=data.get("props_needed", []),
            makeup_notes=data.get("makeup_notes", ""),
            hair_notes=data.get("hair_notes", ""),
            special_requirements=data.get("special_requirements", []),
            scheduled_date=date.fromisoformat(data["scheduled_date"]) if data.get("scheduled_date") else None,
            scheduled_time=time.fromisoformat(data["scheduled_time"]) if data.get("scheduled_time") else None,
            estimated_duration=data.get("estimated_duration"),
            actual_date=date.fromisoformat(data["actual_date"]) if data.get("actual_date") else None,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
