from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from .base import BaseModel, Correction


class AuthorRole(str, Enum):
    LYRICIST = "lyricist"
    COMPOSER = "composer"
    ARRANGER = "arranger"
    PERFORMER = "performer"
    PRODUCER = "producer"
    OTHER = "other"


@dataclass
class AuthorShare(BaseModel):
    author_id: str = ""
    author_name: str = ""
    role: AuthorRole = AuthorRole.COMPOSER
    ratio: float = 0.0
    corrections: List[Correction] = field(default_factory=list)
    notes: str = ""

    def validate(self) -> List[str]:
        errors = []
        if not self.author_name:
            errors.append(f"作者名称不能为空")
        if self.ratio < 0:
            errors.append(f"作者[{self.author_name}]分成比例不能为负数")
        if self.ratio > 1:
            errors.append(f"作者[{self.author_name}]分成比例不能超过1")
        return errors

    def to_dict(self):
        data = super().to_dict()
        data["role"] = self.role.value
        data["corrections"] = [c.to_dict() for c in self.corrections]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "AuthorShare":
        return cls(
            id=data.get("id", cls.id.default_factory()),
            author_id=data.get("author_id", ""),
            author_name=data.get("author_name", ""),
            role=AuthorRole(data.get("role", "composer")),
            ratio=float(data.get("ratio", 0.0)),
            corrections=[Correction(**c) for c in data.get("corrections", [])],
            notes=data.get("notes", ""),
        )
