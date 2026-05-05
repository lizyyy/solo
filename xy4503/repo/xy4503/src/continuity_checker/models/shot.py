from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class ShotStatus(Enum):
    PLANNED = "planned"
    SHOOTING = "shooting"
    COMPLETED = "completed"
    NEEDS_RESHOOT = "needs_reshoot"
    RESHOOT_COMPLETED = "reshoot_completed"


@dataclass
class Shot:
    shot_id: str
    scene_number: str = ""
    shot_number: str = ""
    description: str = ""
    location: str = ""
    setup: str = ""
    actors: List[str] = field(default_factory=list)
    wardrobe: List[str] = field(default_factory=list)
    props: List[str] = field(default_factory=list)
    status: ShotStatus = ShotStatus.PLANNED
    planned_date: Optional[date] = None
    actual_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration: Optional[int] = None
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
            "shot_id": self.shot_id,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "description": self.description,
            "location": self.location,
            "setup": self.setup,
            "actors": self.actors,
            "wardrobe": self.wardrobe,
            "props": self.props,
            "status": self.status.value,
            "planned_date": self.planned_date.isoformat() if self.planned_date else None,
            "actual_date": self.actual_date.isoformat() if self.actual_date else None,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration": self.duration,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Shot':
        return cls(
            shot_id=data["shot_id"],
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            description=data.get("description", ""),
            location=data.get("location", ""),
            setup=data.get("setup", ""),
            actors=data.get("actors", []),
            wardrobe=data.get("wardrobe", []),
            props=data.get("props", []),
            status=ShotStatus(data.get("status", "planned")),
            planned_date=date.fromisoformat(data["planned_date"]) if data.get("planned_date") else None,
            actual_date=date.fromisoformat(data["actual_date"]) if data.get("actual_date") else None,
            start_time=time.fromisoformat(data["start_time"]) if data.get("start_time") else None,
            end_time=time.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            duration=data.get("duration"),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
    
    def update_status(self, new_status: ShotStatus):
        self.status = new_status
        self.updated_at = datetime.now()


@dataclass
class ShotList:
    shots: List[Shot] = field(default_factory=list)
    
    def get_by_shot_id(self, shot_id: str) -> Optional[Shot]:
        for shot in self.shots:
            if shot.shot_id == shot_id:
                return shot
        return None
    
    def get_by_scene(self, scene_number: str) -> List[Shot]:
        return [shot for shot in self.shots if shot.scene_number == scene_number]
    
    def get_by_status(self, status: ShotStatus) -> List[Shot]:
        return [shot for shot in self.shots if shot.status == status]
    
    def get_by_actor(self, actor: str) -> List[Shot]:
        return [shot for shot in self.shots if actor in shot.actors]
    
    def get_all_scenes(self) -> List[str]:
        return sorted(set(shot.scene_number for shot in self.shots if shot.scene_number))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "shots": [shot.to_dict() for shot in self.shots]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ShotList':
        shots = [Shot.from_dict(s) for s in data.get("shots", [])]
        return cls(shots=shots)
