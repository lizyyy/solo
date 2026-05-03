from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from uuid import uuid4

from models.enums import IssueType, IssueSeverity, ReviewStatus


@dataclass
class Issue:
    issue_id: str
    model_id: str
    issue_type: IssueType
    severity: IssueSeverity
    title: str
    description: str = ""
    review_status: ReviewStatus = ReviewStatus.UNREVIEWED
    reviewer_notes: str = ""
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    resolution: str = ""
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "issue_id": self.issue_id,
            "model_id": self.model_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "review_status": self.review_status.value,
            "reviewer_notes": self.reviewer_notes,
            "reviewer_name": self.reviewer_name,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "resolution": self.resolution,
            "is_resolved": self.is_resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Issue":
        issue_type = IssueType(data["issue_type"])
        severity = IssueSeverity(data["severity"])
        review_status = ReviewStatus(data.get("review_status", ReviewStatus.UNREVIEWED.value))
        
        reviewed_at = None
        if data.get("reviewed_at"):
            reviewed_at = datetime.fromisoformat(data["reviewed_at"])
        
        resolved_at = None
        if data.get("resolved_at"):
            resolved_at = datetime.fromisoformat(data["resolved_at"])
        
        created_at = datetime.now()
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        issue = cls(
            issue_id=data["issue_id"],
            model_id=data["model_id"],
            issue_type=issue_type,
            severity=severity,
            title=data["title"],
            description=data.get("description", ""),
            review_status=review_status,
            reviewer_notes=data.get("reviewer_notes", ""),
            reviewer_name=data.get("reviewer_name"),
            reviewed_at=reviewed_at,
            resolution=data.get("resolution", ""),
            is_resolved=data.get("is_resolved", False),
            resolved_at=resolved_at,
            created_at=created_at,
        )
        issue.internal_id = data.get("internal_id", issue.internal_id)
        return issue
