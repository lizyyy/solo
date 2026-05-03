from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from .base import BaseModel


class ReferenceType(Enum):
    TRANSCRIPT = "transcript"
    EVIDENCE_LIST = "evidence_list"
    CROSS_EXAMINATION = "cross_examination"
    JUDGMENT_DRAFT = "judgment_draft"


@dataclass
class Reference(BaseModel):
    evidence_number: str
    reference_type: ReferenceType
    source_file: str
    source_context: str
    line_number: Optional[int] = None
    reference_date: Optional[datetime] = None
    description: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "evidence_number": self.evidence_number,
            "reference_type": self.reference_type.value,
            "source_file": self.source_file,
            "source_context": self.source_context,
            "line_number": self.line_number,
            "reference_date": (
                self.reference_date.isoformat() if self.reference_date else None
            ),
            "description": self.description,
            "aliases": self.aliases,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Reference":
        ref_type = (
            ReferenceType(data["reference_type"])
            if isinstance(data["reference_type"], str)
            else data["reference_type"]
        )
        ref_date = (
            datetime.fromisoformat(data["reference_date"])
            if data.get("reference_date")
            else None
        )
        return cls(
            evidence_number=data["evidence_number"],
            reference_type=ref_type,
            source_file=data["source_file"],
            source_context=data["source_context"],
            line_number=data.get("line_number"),
            reference_date=ref_date,
            description=data.get("description"),
            aliases=data.get("aliases", []),
            metadata=data.get("metadata", {}),
        )
