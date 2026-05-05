from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional
from enum import Enum


class ItemCondition(Enum):
    GOOD = "good"
    MINOR_DAMAGE = "minor_damage"
    MAJOR_DAMAGE = "major_damage"
    LOST = "lost"


@dataclass
class Wardrobe:
    item_id: str
    name: str = ""
    description: str = ""
    actor_id: str = ""
    scene_number: str = ""
    shot_number: str = ""
    color: str = ""
    size: str = ""
    brand: str = ""
    condition: ItemCondition = ItemCondition.GOOD
    photo_paths: List[str] = field(default_factory=list)
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
            "item_id": self.item_id,
            "name": self.name,
            "description": self.description,
            "actor_id": self.actor_id,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "color": self.color,
            "size": self.size,
            "brand": self.brand,
            "condition": self.condition.value,
            "photo_paths": self.photo_paths,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Wardrobe':
        return cls(
            item_id=data["item_id"],
            name=data.get("name", ""),
            description=data.get("description", ""),
            actor_id=data.get("actor_id", ""),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            color=data.get("color", ""),
            size=data.get("size", ""),
            brand=data.get("brand", ""),
            condition=ItemCondition(data.get("condition", "good")),
            photo_paths=data.get("photo_paths", []),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )


@dataclass
class Prop:
    item_id: str
    name: str = ""
    description: str = ""
    scene_number: str = ""
    shot_number: str = ""
    location: str = ""
    owner: str = ""
    handler: str = ""
    condition: ItemCondition = ItemCondition.GOOD
    photo_paths: List[str] = field(default_factory=list)
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
            "item_id": self.item_id,
            "name": self.name,
            "description": self.description,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "location": self.location,
            "owner": self.owner,
            "handler": self.handler,
            "condition": self.condition.value,
            "photo_paths": self.photo_paths,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Prop':
        return cls(
            item_id=data["item_id"],
            name=data.get("name", ""),
            description=data.get("description", ""),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            location=data.get("location", ""),
            owner=data.get("owner", ""),
            handler=data.get("handler", ""),
            condition=ItemCondition(data.get("condition", "good")),
            photo_paths=data.get("photo_paths", []),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )


@dataclass
class WardrobeAnnotation:
    annotation_id: str
    item_type: str = "wardrobe"
    item_id: str = ""
    shot_id: str = ""
    scene_number: str = ""
    shot_number: str = ""
    photo_path: str = ""
    frame_number: Optional[int] = None
    timestamp: Optional[float] = None
    description: str = ""
    tags: List[str] = field(default_factory=list)
    bounding_box: Optional[Dict[str, float]] = None
    condition_note: str = ""
    match_verified: bool = False
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
            "annotation_id": self.annotation_id,
            "item_type": self.item_type,
            "item_id": self.item_id,
            "shot_id": self.shot_id,
            "scene_number": self.scene_number,
            "shot_number": self.shot_number,
            "photo_path": self.photo_path,
            "frame_number": self.frame_number,
            "timestamp": self.timestamp,
            "description": self.description,
            "tags": self.tags,
            "bounding_box": self.bounding_box,
            "condition_note": self.condition_note,
            "match_verified": self.match_verified,
            "notes": self.notes,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'WardrobeAnnotation':
        return cls(
            annotation_id=data["annotation_id"],
            item_type=data.get("item_type", "wardrobe"),
            item_id=data.get("item_id", ""),
            shot_id=data.get("shot_id", ""),
            scene_number=data.get("scene_number", ""),
            shot_number=data.get("shot_number", ""),
            photo_path=data.get("photo_path", ""),
            frame_number=data.get("frame_number"),
            timestamp=data.get("timestamp"),
            description=data.get("description", ""),
            tags=data.get("tags", []),
            bounding_box=data.get("bounding_box"),
            condition_note=data.get("condition_note", ""),
            match_verified=data.get("match_verified", False),
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {}),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
