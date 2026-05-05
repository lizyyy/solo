from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class ActorAvailability(Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    PARTIAL = "partial"
    TENTATIVE = "tentative"


@dataclass
class Actor:
    actor_id: str
    name: str = ""
    character_name: str = ""
    agent: str = ""
    contact: str = ""
    availability_calendar: Dict[str, str] = field(default_factory=dict)
    special_requirements: List[str] = field(default_factory=list)
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def get_availability(self, check_date: date) -> ActorAvailability:
        date_str = check_date.isoformat()
        if date_str in self.availability_calendar:
            try:
                return ActorAvailability(self.availability_calendar[date_str])
            except ValueError:
                pass
        return ActorAvailability.AVAILABLE
    
    def set_availability(self, check_date: date, availability: ActorAvailability):
        self.availability_calendar[check_date.isoformat()] = availability.value
        self.updated_at = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "actor_id": self.actor_id,
            "name": self.name,
            "character_name": self.character_name,
            "agent": self.agent,
            "contact": self.contact,
            "availability_calendar": self.availability_calendar,
            "special_requirements": self.special_requirements,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Actor':
        return cls(
            actor_id=data["actor_id"],
            name=data.get("name", ""),
            character_name=data.get("character_name", ""),
            agent=data.get("agent", ""),
            contact=data.get("contact", ""),
            availability_calendar=data.get("availability_calendar", {}),
            special_requirements=data.get("special_requirements", []),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )


@dataclass
class ActorNote:
    note_id: str
    actor_id: str = ""
    scene_number: str = ""
    shot_number: str = ""
    date: Optional[date] = None
    makeup: str = ""
    hair: str = ""
    special_requirements: List[str] = field(default_factory=list)
    makeup_time: Optional[time] = None
    hair_time: Optional[time] = None
    total_prep_time: Optional[int] = None
    description: str = ""
    photo_paths: List[str] = field(default_factory=list)
    verified: bool = False
    verified_by: str = ""
    verified_at: Optional[datetime] = None
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "note_id": self.note_id,
            "actor_id": self.actor_id,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "date": self.date.isoformat() if self.date else None,
            "makeup": self.makeup,
            "hair": self.hair,
            "special_requirements": self.special_requirements,
            "makeup_time": self.makeup_time.isoformat() if self.makeup_time else None,
            "hair_time": self.hair_time.isoformat() if self.hair_time else None,
            "total_prep_time": self.total_prep_time,
            "description": self.description,
            "photo_paths": self.photo_paths,
            "verified": self.verified,
            "verified_by": self.verified_by,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ActorNote':
        return cls(
            note_id=data["note_id"],
            actor_id=data.get("actor_id", ""),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            date=date.fromisoformat(data["date"]) if data.get("date") else None,
            makeup=data.get("makeup", ""),
            hair=data.get("hair", ""),
            special_requirements=data.get("special_requirements", []),
            makeup_time=time.fromisoformat(data["makeup_time"]) if data.get("makeup_time") else None,
            hair_time=time.fromisoformat(data["hair_time"]) if data.get("hair_time") else None,
            total_prep_time=data.get("total_prep_time"),
            description=data.get("description", ""),
            photo_paths=data.get("photo_paths", []),
            verified=data.get("verified", False),
            verified_by=data.get("verified_by", ""),
            verified_at=datetime.fromisoformat(data["verified_at"]) if data.get("verified_at") else None,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
