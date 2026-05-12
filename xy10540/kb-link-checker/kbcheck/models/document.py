import hashlib
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class Document:
    doc_id: str
    title: str
    path: str
    file_type: str
    content_hash: str
    owner_id: str
    visibility: str
    tags: List[str] = field(default_factory=list)
    last_modified: datetime = None
    extracted_at: datetime = None

    @classmethod
    def from_dict(cls, data: dict) -> "Document":
        return cls(
            doc_id=data["doc_id"],
            title=data["title"],
            path=data["path"],
            file_type=data["file_type"],
            content_hash=data["content_hash"],
            owner_id=data["owner_id"],
            visibility=data.get("visibility", "internal"),
            tags=data.get("tags", []),
            last_modified=datetime.fromisoformat(data["last_modified"]) if data.get("last_modified") else None,
            extracted_at=datetime.fromisoformat(data["extracted_at"]) if data.get("extracted_at") else datetime.now(),
        )

    def to_dict(self) -> dict:
        return {
            "doc_id": self.doc_id,
            "title": self.title,
            "path": self.path,
            "file_type": self.file_type,
            "content_hash": self.content_hash,
            "owner_id": self.owner_id,
            "visibility": self.visibility,
            "tags": self.tags,
            "last_modified": self.last_modified.isoformat() if self.last_modified else None,
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None,
        }
