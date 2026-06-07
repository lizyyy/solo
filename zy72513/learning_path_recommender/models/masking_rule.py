from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Pattern
from datetime import datetime
import re
import uuid


@dataclass
class MaskingRule:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    pattern: str = ""
    replacement: str = ""
    description: str = ""
    category: str = "default"
    is_enabled: bool = True
    severity: str = "medium"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    _compiled_pattern: Optional[Pattern] = field(default=None, repr=False)

    def compile(self) -> Pattern:
        if self._compiled_pattern is None:
            self._compiled_pattern = re.compile(self.pattern)
        return self._compiled_pattern

    def apply(self, text: str) -> str:
        if not self.is_enabled:
            return text
        pattern = self.compile()
        return pattern.sub(self.replacement, text)

    def check(self, text: str) -> bool:
        if not self.is_enabled:
            return False
        pattern = self.compile()
        return bool(pattern.search(text))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "pattern": self.pattern,
            "replacement": self.replacement,
            "description": self.description,
            "category": self.category,
            "is_enabled": self.is_enabled,
            "severity": self.severity,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MaskingRule":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", ""),
            pattern=data.get("pattern", ""),
            replacement=data.get("replacement", ""),
            description=data.get("description", ""),
            category=data.get("category", "default"),
            is_enabled=data.get("is_enabled", True),
            severity=data.get("severity", "medium"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            metadata=data.get("metadata", {}),
        )
