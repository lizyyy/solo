from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any
from enum import Enum


class ChargeSign(Enum):
    POSITIVE = 1
    NEGATIVE = -1
    UNKNOWN = 0


class IssueType(Enum):
    DIRECTION_REVERSED = "direction_reversed"
    LINE_TRAVERSES_CHARGE = "line_traverses_charge"
    DENSITY_MISJUDGED = "density_misjudged"
    BAD_DATA = "bad_data"
    DATA_CONFLICT = "data_conflict"


@dataclass
class SourceInfo:
    source_file: str
    line_number: Optional[int] = None
    raw_content: Optional[str] = None
    student_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_file": self.source_file,
            "line_number": self.line_number,
            "raw_content": self.raw_content,
            "student_id": self.student_id,
        }


@dataclass
class Charge:
    position: Tuple[float, float]
    sign: ChargeSign
    magnitude: float = 1.0
    source: Optional[SourceInfo] = None
    charge_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "charge_id": self.charge_id,
            "position": self.position,
            "sign": self.sign.name,
            "magnitude": self.magnitude,
            "source": self.source.to_dict() if self.source else None,
        }


@dataclass
class Arrow:
    position: Tuple[float, float]
    direction: Tuple[float, float]
    source: Optional[SourceInfo] = None
    arrow_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "arrow_id": self.arrow_id,
            "position": self.position,
            "direction": self.direction,
            "source": self.source.to_dict() if self.source else None,
        }


@dataclass
class FieldLine:
    points: List[Tuple[float, float]]
    arrows: List[Arrow] = field(default_factory=list)
    source: Optional[SourceInfo] = None
    line_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "line_id": self.line_id,
            "points": self.points,
            "arrows": [a.to_dict() for a in self.arrows],
            "source": self.source.to_dict() if self.source else None,
        }


@dataclass
class StudentSubmission:
    charges: List[Charge]
    field_lines: List[FieldLine]
    submission_id: str
    source_file: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "submission_id": self.submission_id,
            "source_file": self.source_file,
            "charges": [c.to_dict() for c in self.charges],
            "field_lines": [l.to_dict() for l in self.field_lines],
        }


@dataclass
class Issue:
    issue_type: IssueType
    description: str
    business_explanation: str
    severity: str
    source: Optional[SourceInfo] = None
    evidence: Dict[str, Any] = field(default_factory=dict)
    related_objects: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity,
            "description": self.description,
            "business_explanation": self.business_explanation,
            "source": self.source.to_dict() if self.source else None,
            "evidence": self.evidence,
            "related_objects": self.related_objects,
        }


@dataclass
class CheckReport:
    submission_id: str
    source_file: str
    total_lines_checked: int
    total_charges_checked: int
    total_arrows_checked: int
    issues: List[Issue]
    summary: Dict[str, int]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "submission_id": self.submission_id,
            "source_file": self.source_file,
            "total_lines_checked": self.total_lines_checked,
            "total_charges_checked": self.total_charges_checked,
            "total_arrows_checked": self.total_arrows_checked,
            "summary": self.summary,
            "issues": [i.to_dict() for i in self.issues],
        }
