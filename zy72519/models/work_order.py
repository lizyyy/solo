from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class WorkOrderStatus(str, Enum):
    PENDING = "pending"
    CLASSIFIED = "classified"
    CONFLICT = "conflict"
    RESOLVED = "resolved"
    NEED_REVIEW = "need_review"


@dataclass
class WorkOrder:
    id: str
    title: str
    content: str
    category: str
    source: str
    feedback_time: datetime
    import_time: datetime
    status: WorkOrderStatus = WorkOrderStatus.PENDING
    reference_links: List[str] = field(default_factory=list)
    original_raw_data: dict = field(default_factory=dict)
    import_batch: str = ""
    is_supplementary: bool = False
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    review_notes: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "category": self.category,
            "source": self.source,
            "feedback_time": self.feedback_time.isoformat() if self.feedback_time else None,
            "import_time": self.import_time.isoformat() if self.import_time else None,
            "status": self.status.value,
            "reference_links": self.reference_links,
            "original_raw_data": self.original_raw_data,
            "import_batch": self.import_batch,
            "is_supplementary": self.is_supplementary,
            "reviewer": self.reviewer,
            "review_time": self.review_time.isoformat() if self.review_time else None,
            "review_notes": self.review_notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WorkOrder":
        return cls(
            id=data["id"],
            title=data["title"],
            content=data["content"],
            category=data["category"],
            source=data["source"],
            feedback_time=datetime.fromisoformat(data["feedback_time"]) if data.get("feedback_time") else None,
            import_time=datetime.fromisoformat(data["import_time"]) if data.get("import_time") else datetime.now(),
            status=WorkOrderStatus(data.get("status", "pending")),
            reference_links=data.get("reference_links", []),
            original_raw_data=data.get("original_raw_data", {}),
            import_batch=data.get("import_batch", ""),
            is_supplementary=data.get("is_supplementary", False),
            reviewer=data.get("reviewer"),
            review_time=datetime.fromisoformat(data["review_time"]) if data.get("review_time") else None,
            review_notes=data.get("review_notes", ""),
        )
