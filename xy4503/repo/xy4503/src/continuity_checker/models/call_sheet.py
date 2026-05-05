from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class CallTimeType(Enum):
    ACTOR = "actor"
    CREW = "crew"
    DIRECTOR = "director"
    PRODUCER = "producer"
    SPECIAL = "special"


@dataclass
class CallSheetEntry:
    entry_id: str
    name: str = ""
    role: str = ""
    call_time_type: CallTimeType = CallTimeType.CREW
    call_time: Optional[time] = None
    makeup_time: Optional[time] = None
    hair_time: Optional[time] = None
    wardrobe_time: Optional[time] = None
    ready_time: Optional[time] = None
    on_set_time: Optional[time] = None
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "name": self.name,
            "role": self.role,
            "call_time_type": self.call_time_type.value,
            "call_time": self.call_time.isoformat() if self.call_time else None,
            "makeup_time": self.makeup_time.isoformat() if self.makeup_time else None,
            "hair_time": self.hair_time.isoformat() if self.hair_time else None,
            "wardrobe_time": self.wardrobe_time.isoformat() if self.wardrobe_time else None,
            "ready_time": self.ready_time.isoformat() if self.ready_time else None,
            "on_set_time": self.on_set_time.isoformat() if self.on_set_time else None,
            "notes": self.notes,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CallSheetEntry':
        return cls(
            entry_id=data["entry_id"],
            name=data.get("name", ""),
            role=data.get("role", ""),
            call_time_type=CallTimeType(data.get("call_time_type", "crew")),
            call_time=time.fromisoformat(data["call_time"]) if data.get("call_time") else None,
            makeup_time=time.fromisoformat(data["makeup_time"]) if data.get("makeup_time") else None,
            hair_time=time.fromisoformat(data["hair_time"]) if data.get("hair_time") else None,
            wardrobe_time=time.fromisoformat(data["wardrobe_time"]) if data.get("wardrobe_time") else None,
            ready_time=time.fromisoformat(data["ready_time"]) if data.get("ready_time") else None,
            on_set_time=time.fromisoformat(data["on_set_time"]) if data.get("on_set_time") else None,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {})
        )


@dataclass
class CallSheet:
    call_sheet_id: str
    date: Optional[date] = None
    day_number: str = ""
    weather: str = ""
    sunrise: Optional[time] = None
    sunset: Optional[time] = None
    shooting_location: str = ""
    parking_location: str = ""
    scenes_to_shoot: List[str] = field(default_factory=list)
    entries: List[CallSheetEntry] = field(default_factory=list)
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def get_actor_entries(self) -> List[CallSheetEntry]:
        return [e for e in self.entries if e.call_time_type == CallTimeType.ACTOR]
    
    def get_crew_entries(self) -> List[CallSheetEntry]:
        return [e for e in self.entries if e.call_time_type == CallTimeType.CREW]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "call_sheet_id": self.call_sheet_id,
            "date": self.date.isoformat() if self.date else None,
            "day_number": self.day_number,
            "weather": self.weather,
            "sunrise": self.sunrise.isoformat() if self.sunrise else None,
            "sunset": self.sunset.isoformat() if self.sunset else None,
            "shooting_location": self.shooting_location,
            "parking_location": self.parking_location,
            "scenes_to_shoot": self.scenes_to_shoot,
            "entries": [e.to_dict() for e in self.entries],
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CallSheet':
        entries = [CallSheetEntry.from_dict(e) for e in data.get("entries", [])]
        return cls(
            call_sheet_id=data["call_sheet_id"],
            date=date.fromisoformat(data["date"]) if data.get("date") else None,
            day_number=data.get("day_number", ""),
            weather=data.get("weather", ""),
            sunrise=time.fromisoformat(data["sunrise"]) if data.get("sunrise") else None,
            sunset=time.fromisoformat(data["sunset"]) if data.get("sunset") else None,
            shooting_location=data.get("shooting_location", ""),
            parking_location=data.get("parking_location", ""),
            scenes_to_shoot=data.get("scenes_to_shoot", []),
            entries=entries,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
