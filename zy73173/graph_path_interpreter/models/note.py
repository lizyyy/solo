from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class VerbalNote:
    note_id: str
    content: str
    author: str
    created_at: datetime = field(default_factory=datetime.now)
    related_record_id: Optional[str] = None
    related_event: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "note_id": self.note_id,
            "content": self.content,
            "author": self.author,
            "created_at": self.created_at.isoformat(),
            "related_record_id": self.related_record_id,
            "related_event": self.related_event,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "VerbalNote":
        return cls(
            note_id=data["note_id"],
            content=data["content"],
            author=data["author"],
            created_at=datetime.fromisoformat(data["created_at"]),
            related_record_id=data.get("related_record_id"),
            related_event=data.get("related_event"),
        )
