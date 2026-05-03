from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from .base import BaseModel


class ObjectionType(Enum):
    RELEVANCE = "relevance"
    HEARSAY = "hearsay"
    AUTHENTICITY = "authenticity"
    OPINION = "opinion"
    PRIVILEGE = "privilege"
    OTHER = "other"


class ObjectionStatus(Enum):
    RAISED = "raised"
    SUSTAINED = "sustained"
    OVERRULED = "overruled"
    PENDING = "pending"
    WITHDRAWN = "withdrawn"


@dataclass
class Objection(BaseModel):
    objection_id: str
    evidence_number: str
    objection_type: ObjectionType
    raised_by: str
    raised_at: Optional[datetime] = None
    description: Optional[str] = None
    status: ObjectionStatus = ObjectionStatus.RAISED
    ruling: Optional[str] = None
    ruling_at: Optional[datetime] = None
    source_file: Optional[str] = None
    line_number: Optional[int] = None
    cross_references: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

    @property
    def is_resolved(self) -> bool:
        return self.status in [
            ObjectionStatus.SUSTAINED,
            ObjectionStatus.OVERRULED,
            ObjectionStatus.WITHDRAWN,
        ]

    @property
    def requires_attention(self) -> bool:
        return self.status == ObjectionStatus.PENDING or (
            self.status == ObjectionStatus.RAISED and not self.ruling
        )

    def to_dict(self) -> Dict:
        return {
            "objection_id": self.objection_id,
            "evidence_number": self.evidence_number,
            "objection_type": self.objection_type.value,
            "raised_by": self.raised_by,
            "raised_at": self.raised_at.isoformat() if self.raised_at else None,
            "description": self.description,
            "status": self.status.value,
            "ruling": self.ruling,
            "ruling_at": self.ruling_at.isoformat() if self.ruling_at else None,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "cross_references": self.cross_references,
            "is_resolved": self.is_resolved,
            "requires_attention": self.requires_attention,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Objection":
        obj_type = (
            ObjectionType(data["objection_type"])
            if isinstance(data["objection_type"], str)
            else data["objection_type"]
        )
        status = (
            ObjectionStatus(data.get("status", "raised"))
            if isinstance(data.get("status"), str)
            else data.get("status", ObjectionStatus.RAISED)
        )
        raised_at = (
            datetime.fromisoformat(data["raised_at"]) if data.get("raised_at") else None
        )
        ruling_at = (
            datetime.fromisoformat(data["ruling_at"]) if data.get("ruling_at") else None
        )
        return cls(
            objection_id=data["objection_id"],
            evidence_number=data["evidence_number"],
            objection_type=obj_type,
            raised_by=data["raised_by"],
            raised_at=raised_at,
            description=data.get("description"),
            status=status,
            ruling=data.get("ruling"),
            ruling_at=ruling_at,
            source_file=data.get("source_file"),
            line_number=data.get("line_number"),
            cross_references=data.get("cross_references", []),
            metadata=data.get("metadata", {}),
        )
