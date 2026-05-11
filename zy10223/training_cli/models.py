from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class SubmissionStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    RESUBMITTED = "resubmitted"
    GRADED = "graded"
    LATE = "late"
    LATE_GRADED = "late_graded"


class CertificationStatus(str, Enum):
    QUALIFIED = "qualified"
    AT_RISK = "at_risk"
    DISQUALIFIED = "disqualified"


@dataclass
class Student:
    id: str
    name: str
    group: str
    emails: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)
    notes: str = ""
    
    def matches(self, identifier: str) -> bool:
        identifier = identifier.strip().lower()
        if identifier == self.id.lower():
            return True
        if identifier == self.name.lower():
            return True
        if identifier in [e.lower() for e in self.emails]:
            return True
        if identifier in [a.lower() for a in self.aliases]:
            return True
        return False


@dataclass
class Assignment:
    id: str
    name: str
    round_num: int
    deadline: datetime
    required: bool = True
    description: str = ""
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Assignment":
        return cls(
            id=data["id"],
            name=data["name"],
            round_num=data["round_num"],
            deadline=datetime.fromisoformat(data["deadline"]),
            required=data.get("required", True),
            description=data.get("description", ""),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "round_num": self.round_num,
            "deadline": self.deadline.isoformat(),
            "required": self.required,
            "description": self.description,
        }


@dataclass
class Submission:
    id: str
    student_id: str
    assignment_id: str
    submitted_at: datetime
    score: Optional[float] = None
    status: SubmissionStatus = SubmissionStatus.SUBMITTED
    is_resubmit: bool = False
    resubmit_reason: str = ""
    grader_notes: str = ""
    source_identifier: str = ""
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Submission":
        return cls(
            id=data["id"],
            student_id=data["student_id"],
            assignment_id=data["assignment_id"],
            submitted_at=datetime.fromisoformat(data["submitted_at"]),
            score=data.get("score"),
            status=SubmissionStatus(data.get("status", "submitted")),
            is_resubmit=data.get("is_resubmit", False),
            resubmit_reason=data.get("resubmit_reason", ""),
            grader_notes=data.get("grader_notes", ""),
            source_identifier=data.get("source_identifier", ""),
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "assignment_id": self.assignment_id,
            "submitted_at": self.submitted_at.isoformat(),
            "score": self.score,
            "status": self.status.value,
            "is_resubmit": self.is_resubmit,
            "resubmit_reason": self.resubmit_reason,
            "grader_notes": self.grader_notes,
            "source_identifier": self.source_identifier,
        }


@dataclass
class CertificationRules:
    min_required_assignments: int
    max_late_submissions: int
    allow_late_for_cert: bool
    require_all_graded: bool
    min_avg_score: Optional[float] = None
    exclude_rounds: List[int] = field(default_factory=list)
    
    @classmethod
    def default(cls) -> "CertificationRules":
        return cls(
            min_required_assignments=3,
            max_late_submissions=1,
            allow_late_for_cert=False,
            require_all_graded=True,
            min_avg_score=60.0,
            exclude_rounds=[],
        )


@dataclass
class Anomaly:
    type: str
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StudentHistory:
    student: Student
    submissions: List[Submission]
    anomalies: List[Anomaly]
    certification_status: CertificationStatus
