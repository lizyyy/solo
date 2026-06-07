from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


@dataclass
class VersionHistory:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    recommendation_id: str = ""
    version: int = 1
    previous_version: Optional[int] = None
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_summary: str = ""
    changed_by: Optional[str] = None
    changed_at: datetime = field(default_factory=datetime.now)
    change_reason: Optional[str] = None
    source: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "recommendation_id": self.recommendation_id,
            "version": self.version,
            "previous_version": self.previous_version,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "change_summary": self.change_summary,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat(),
            "change_reason": self.change_reason,
            "source": self.source,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VersionHistory":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            recommendation_id=data.get("recommendation_id", ""),
            version=data.get("version", 1),
            previous_version=data.get("previous_version"),
            field_name=data.get("field_name"),
            old_value=data.get("old_value"),
            new_value=data.get("new_value"),
            change_summary=data.get("change_summary", ""),
            changed_by=data.get("changed_by"),
            changed_at=datetime.fromisoformat(data["changed_at"]) if data.get("changed_at") else datetime.now(),
            change_reason=data.get("change_reason"),
            source=data.get("source"),
            metadata=data.get("metadata", {}),
        )
