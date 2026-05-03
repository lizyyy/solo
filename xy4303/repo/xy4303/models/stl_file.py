from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4


@dataclass
class STLFile:
    file_path: str
    model_id: str
    jaw: Optional[str] = None
    file_size: int = 0
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    vertex_count: Optional[int] = None
    triangle_count: Optional[int] = None
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
            "jaw": self.jaw,
            "file_size": self.file_size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "modified_at": self.modified_at.isoformat() if self.modified_at else None,
            "vertex_count": self.vertex_count,
            "triangle_count": self.triangle_count,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "STLFile":
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        modified_at = None
        if data.get("modified_at"):
            modified_at = datetime.fromisoformat(data["modified_at"])
        
        stl_file = cls(
            file_path=data["file_path"],
            model_id=data["model_id"],
            jaw=data.get("jaw"),
            file_size=data.get("file_size", 0),
            created_at=created_at,
            modified_at=modified_at,
            vertex_count=data.get("vertex_count"),
            triangle_count=data.get("triangle_count"),
            notes=data.get("notes", ""),
        )
        stl_file.internal_id = data.get("internal_id", stl_file.internal_id)
        return stl_file
