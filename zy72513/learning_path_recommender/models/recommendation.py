from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


@dataclass
class Recommendation:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    source_model_output: Optional[str] = None
    source_manual_review: Optional[str] = None
    model_output_id: Optional[str] = None
    manual_review_id: Optional[str] = None
    batch_id: Optional[str] = None
    masking_status: str = "pending"
    has_unmasked_phone: bool = False
    review_status: str = "pending"
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "source_model_output": self.source_model_output,
            "source_manual_review": self.source_manual_review,
            "model_output_id": self.model_output_id,
            "manual_review_id": self.manual_review_id,
            "batch_id": self.batch_id,
            "masking_status": self.masking_status,
            "has_unmasked_phone": self.has_unmasked_phone,
            "review_status": self.review_status,
            "reviewer": self.reviewer,
            "review_comment": self.review_comment,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "version": self.version,
            "metadata": self.metadata,
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Recommendation":
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            content=data.get("content", ""),
            source_model_output=data.get("source_model_output"),
            source_manual_review=data.get("source_manual_review"),
            model_output_id=data.get("model_output_id"),
            manual_review_id=data.get("manual_review_id"),
            batch_id=data.get("batch_id"),
            masking_status=data.get("masking_status", "pending"),
            has_unmasked_phone=data.get("has_unmasked_phone", False),
            review_status=data.get("review_status", "pending"),
            reviewer=data.get("reviewer"),
            review_comment=data.get("review_comment"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            version=data.get("version", 1),
            metadata=data.get("metadata", {}),
            is_active=data.get("is_active", True),
        )
