from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from models.enums import PhotoType


@dataclass
class Photo:
    file_path: str
    model_id: str
    photo_type: PhotoType = PhotoType.OTHER
    taken_at: Optional[datetime] = None
    file_size: int = 0
    width: Optional[int] = None
    height: Optional[int] = None
    notes: str = ""
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    @property
    def file_name(self) -> str:
        return Path(self.file_path).name

    @property
    def file_extension(self) -> str:
        return Path(self.file_path).suffix.lower()

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "file_path": self.file_path,
            "model_id": self.model_id,
            "photo_type": self.photo_type.value,
            "taken_at": self.taken_at.isoformat() if self.taken_at else None,
            "file_size": self.file_size,
            "width": self.width,
            "height": self.height,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Photo":
        taken_at = None
        if data.get("taken_at"):
            taken_at = datetime.fromisoformat(data["taken_at"])
        
        photo_type = PhotoType(data.get("photo_type", PhotoType.OTHER.value))
        
        photo = cls(
            file_path=data["file_path"],
            model_id=data["model_id"],
            photo_type=photo_type,
            taken_at=taken_at,
            file_size=data.get("file_size", 0),
            width=data.get("width"),
            height=data.get("height"),
            notes=data.get("notes", ""),
        )
        photo.internal_id = data.get("internal_id", photo.internal_id)
        return photo
