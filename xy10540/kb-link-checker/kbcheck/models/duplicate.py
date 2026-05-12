from dataclasses import dataclass, field
from typing import List
from datetime import datetime


@dataclass
class DuplicatePage:
    duplicate_id: str
    primary_doc_id: str
    duplicate_doc_ids: List[str]
    similarity_score: float
    reason: str
    cross_references: List[dict] = field(default_factory=list)
    detected_at: datetime = None

    @classmethod
    def from_dict(cls, data: dict) -> "DuplicatePage":
        return cls(
            duplicate_id=data["duplicate_id"],
            primary_doc_id=data["primary_doc_id"],
            duplicate_doc_ids=data["duplicate_doc_ids"],
            similarity_score=data["similarity_score"],
            reason=data["reason"],
            cross_references=data.get("cross_references", []),
            detected_at=datetime.fromisoformat(data["detected_at"]) if data.get("detected_at") else datetime.now(),
        )

    def to_dict(self) -> dict:
        return {
            "duplicate_id": self.duplicate_id,
            "primary_doc_id": self.primary_doc_id,
            "duplicate_doc_ids": self.duplicate_doc_ids,
            "similarity_score": self.similarity_score,
            "reason": self.reason,
            "cross_references": self.cross_references,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
        }
