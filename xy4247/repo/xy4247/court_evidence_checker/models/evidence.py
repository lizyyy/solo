from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from .base import BaseModel


class EvidenceType(Enum):
    DOCUMENT = "document"
    PHYSICAL = "physical"
    WITNESS = "witness"
    AUDIO_VIDEO = "audio_video"
    EXPERT = "expert"
    OTHER = "other"


class EvidenceStatus(Enum):
    SUBMITTED = "submitted"
    ADMITTED = "admitted"
    EXCLUDED = "excluded"
    PENDING = "pending"


@dataclass
class Evidence(BaseModel):
    evidence_number: str
    display_name: str
    evidence_type: EvidenceType
    submitter: str
    submission_date: Optional[datetime] = None
    description: Optional[str] = None
    status: EvidenceStatus = EvidenceStatus.SUBMITTED
    aliases: List[str] = field(default_factory=list)
    related_evidence: List[str] = field(default_factory=list)
    page_count: Optional[int] = None
    source_file: Optional[str] = None
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "evidence_number": self.evidence_number,
            "display_name": self.display_name,
            "evidence_type": self.evidence_type.value,
            "submitter": self.submitter,
            "submission_date": (
                self.submission_date.isoformat() if self.submission_date else None
            ),
            "description": self.description,
            "status": self.status.value,
            "aliases": self.aliases,
            "related_evidence": self.related_evidence,
            "page_count": self.page_count,
            "source_file": self.source_file,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Evidence":
        ev_type = (
            EvidenceType(data["evidence_type"])
            if isinstance(data["evidence_type"], str)
            else data["evidence_type"]
        )
        status = (
            EvidenceStatus(data.get("status", "submitted"))
            if isinstance(data.get("status"), str)
            else data.get("status", EvidenceStatus.SUBMITTED)
        )
        sub_date = (
            datetime.fromisoformat(data["submission_date"])
            if data.get("submission_date")
            else None
        )
        return cls(
            evidence_number=data["evidence_number"],
            display_name=data["display_name"],
            evidence_type=ev_type,
            submitter=data["submitter"],
            submission_date=sub_date,
            description=data.get("description"),
            status=status,
            aliases=data.get("aliases", []),
            related_evidence=data.get("related_evidence", []),
            page_count=data.get("page_count"),
            source_file=data.get("source_file"),
            metadata=data.get("metadata", {}),
        )


@dataclass
class EvidenceCatalog(BaseModel):
    evidences: Dict[str, Evidence] = field(default_factory=dict)
    case_number: Optional[str] = None
    case_name: Optional[str] = None
    hearing_date: Optional[datetime] = None

    def add_evidence(self, evidence: Evidence) -> None:
        self.evidences[evidence.evidence_number] = evidence
        for alias in evidence.aliases:
            if alias not in self.evidences:
                self.evidences[alias] = evidence

    def get_evidence(self, number: str) -> Optional[Evidence]:
        return self.evidences.get(number)

    def get_all_evidence_numbers(self) -> List[str]:
        return [e.evidence_number for e in self.evidences.values()]

    def to_dict(self) -> Dict:
        return {
            "case_number": self.case_number,
            "case_name": self.case_name,
            "hearing_date": (
                self.hearing_date.isoformat() if self.hearing_date else None
            ),
            "evidences": {k: v.to_dict() for k, v in self.evidences.items()},
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "EvidenceCatalog":
        evidences = {}
        for k, v in data.get("evidences", {}).items():
            evidences[k] = Evidence.from_dict(v)
        hearing_date = (
            datetime.fromisoformat(data["hearing_date"])
            if data.get("hearing_date")
            else None
        )
        return cls(
            case_number=data.get("case_number"),
            case_name=data.get("case_name"),
            hearing_date=hearing_date,
            evidences=evidences,
        )
