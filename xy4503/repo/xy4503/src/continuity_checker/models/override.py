from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class OverrideType(Enum):
    DISMISS_ISSUE = "dismiss_issue"
    CONFIRM_ISSUE = "confirm_issue"
    ADD_NOTE = "add_note"
    CORRECT_DATA = "correct_data"


class OverrideStatus(Enum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    EXPIRED = "expired"


@dataclass
class OverrideNote:
    override_id: str
    related_issue_id: str = ""
    override_type: OverrideType = OverrideType.ADD_NOTE
    status: OverrideStatus = OverrideStatus.ACTIVE
    title: str = ""
    reason: str = ""
    author: str = ""
    scene_number: str = ""
    shot_id: str = ""
    actor_id: str = ""
    corrected_data: Dict[str, Any] = field(default_factory=dict)
    notes: str = ""
    expires_at: Optional[datetime] = None
    superseded_by: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def is_active(self) -> bool:
        if self.status != OverrideStatus.ACTIVE:
            return False
        if self.expires_at and self.expires_at < datetime.now():
            return False
        return True
    
    def expire(self):
        self.status = OverrideStatus.EXPIRED
        self.updated_at = datetime.now()
    
    def supersede(self, new_override_id: str):
        self.status = OverrideStatus.SUPERSEDED
        self.superseded_by = new_override_id
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "override_id": self.override_id,
            "related_issue_id": self.related_issue_id,
            "override_type": self.override_type.value,
            "status": self.status.value,
            "title": self.title,
            "reason": self.reason,
            "author": self.author,
            "scene_number": self.scene_number,
            "shot_id": self.shot_id,
            "actor_id": self.actor_id,
            "corrected_data": self.corrected_data,
            "notes": self.notes,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "superseded_by": self.superseded_by,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OverrideNote':
        return cls(
            override_id=data["override_id"],
            related_issue_id=data.get("related_issue_id", ""),
            override_type=OverrideType(data.get("override_type", "add_note")),
            status=OverrideStatus(data.get("status", "active")),
            title=data.get("title", ""),
            reason=data.get("reason", ""),
            author=data.get("author", ""),
            scene_number=data.get("scene_number", ""),
            shot_id=data.get("shot_id", ""),
            actor_id=data.get("actor_id", ""),
            corrected_data=data.get("corrected_data", {}),
            notes=data.get("notes", ""),
            expires_at=datetime.fromisoformat(data["expires_at"]) if data.get("expires_at") else None,
            superseded_by=data.get("superseded_by", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )


@dataclass
class OverrideCollection:
    overrides: List[OverrideNote] = field(default_factory=list)
    
    def add_override(self, override: OverrideNote) -> None:
        existing = self.get_active_for_issue(override.related_issue_id)
        if existing:
            existing.supersede(override.override_id)
        
        self.overrides.append(override)
    
    def get_by_issue(self, issue_id: str) -> List[OverrideNote]:
        return [o for o in self.overrides if o.related_issue_id == issue_id]
    
    def get_active_for_issue(self, issue_id: str) -> Optional[OverrideNote]:
        for override in self.overrides:
            if override.related_issue_id == issue_id and override.is_active():
                return override
        return None
    
    def get_active_overrides(self) -> List[OverrideNote]:
        return [o for o in self.overrides if o.is_active()]
    
    def is_issue_dismissed(self, issue_id: str) -> bool:
        active = self.get_active_for_issue(issue_id)
        return active is not None and active.override_type == OverrideType.DISMISS_ISSUE
    
    def is_issue_confirmed(self, issue_id: str) -> bool:
        active = self.get_active_for_issue(issue_id)
        return active is not None and active.override_type == OverrideType.CONFIRM_ISSUE
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overrides": [o.to_dict() for o in self.overrides]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OverrideCollection':
        overrides = [OverrideNote.from_dict(o) for o in data.get("overrides", [])]
        return cls(overrides=overrides)
