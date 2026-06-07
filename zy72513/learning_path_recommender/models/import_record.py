from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid


@dataclass
class ImportRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    batch_id: str = ""
    source_type: str = ""
    source_file: Optional[str] = None
    imported_by: Optional[str] = None
    imported_at: datetime = field(default_factory=datetime.now)
    item_count: int = 0
    duplicate_count: int = 0
    new_count: int = 0
    updated_count: int = 0
    status: str = "completed"
    error_message: Optional[str] = None
    item_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "source_type": self.source_type,
            "source_file": self.source_file,
            "imported_by": self.imported_by,
            "imported_at": self.imported_at.isoformat(),
            "item_count": self.item_count,
            "duplicate_count": self.duplicate_count,
            "new_count": self.new_count,
            "updated_count": self.updated_count,
            "status": self.status,
            "error_message": self.error_message,
            "item_ids": self.item_ids,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportRecord":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            batch_id=data.get("batch_id", ""),
            source_type=data.get("source_type", ""),
            source_file=data.get("source_file"),
            imported_by=data.get("imported_by"),
            imported_at=datetime.fromisoformat(data["imported_at"]) if data.get("imported_at") else datetime.now(),
            item_count=data.get("item_count", 0),
            duplicate_count=data.get("duplicate_count", 0),
            new_count=data.get("new_count", 0),
            updated_count=data.get("updated_count", 0),
            status=data.get("status", "completed"),
            error_message=data.get("error_message"),
            item_ids=data.get("item_ids", []),
            metadata=data.get("metadata", {}),
        )
