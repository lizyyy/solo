from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import uuid4


class IssueType(Enum):
    CALIBRATION_EXPIRED = "calibration_expired"
    CALIBRATION_MISSING = "calibration_missing"
    RESULT_MISSING = "result_missing"
    RESULT_DUPLICATE = "result_duplicate"
    CHANNEL_SWAPPED = "channel_swapped"
    THRESHOLD_ANOMALY = "threshold_anomaly"
    THRESHOLD_EXTREME = "threshold_extreme"
    LOG_TIME_DRIFT = "log_time_drift"
    INVALID_DATA = "invalid_data"
    MISSING_FIELD = "missing_field"
    OTHER = "other"


class IssueSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReviewStatus(Enum):
    UNREVIEWED = "unreviewed"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    RESOLVED = "resolved"


@dataclass
class ValidationIssue:
    issue_id: str = field(default_factory=lambda: str(uuid4()))
    issue_type: IssueType = IssueType.OTHER
    severity: IssueSeverity = IssueSeverity.MEDIUM
    title: str = ""
    description: str = ""
    affected_device_id: Optional[str] = None
    affected_student_id: Optional[str] = None
    affected_screening_id: Optional[str] = None
    affected_log_id: Optional[str] = None
    affected_certificate_id: Optional[str] = None
    detection_timestamp: datetime = field(default_factory=datetime.now)
    review_status: ReviewStatus = ReviewStatus.UNREVIEWED
    review_notes: Optional[str] = None
    reviewer: Optional[str] = None
    review_timestamp: Optional[datetime] = None
    details: Dict[str, Any] = field(default_factory=dict)
    source_file: Optional[str] = None
    
    def mark_reviewed(self, status: ReviewStatus, notes: Optional[str] = None, 
                      reviewer: Optional[str] = None) -> None:
        self.review_status = status
        self.review_notes = notes
        self.reviewer = reviewer
        self.review_timestamp = datetime.now()
    
    def to_dict(self) -> dict:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "affected_device_id": self.affected_device_id,
            "affected_student_id": self.affected_student_id,
            "affected_screening_id": self.affected_screening_id,
            "affected_log_id": self.affected_log_id,
            "affected_certificate_id": self.affected_certificate_id,
            "detection_timestamp": self.detection_timestamp.isoformat(),
            "review_status": self.review_status.value,
            "review_notes": self.review_notes,
            "reviewer": self.reviewer,
            "review_timestamp": self.review_timestamp.isoformat() if self.review_timestamp else None,
            "details": self.details,
            "source_file": self.source_file
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ValidationIssue":
        issue_type = IssueType.OTHER
        if data.get("issue_type"):
            try:
                issue_type = IssueType(data["issue_type"])
            except ValueError:
                pass
        
        severity = IssueSeverity.MEDIUM
        if data.get("severity"):
            try:
                severity = IssueSeverity(data["severity"])
            except ValueError:
                pass
        
        review_status = ReviewStatus.UNREVIEWED
        if data.get("review_status"):
            try:
                review_status = ReviewStatus(data["review_status"])
            except ValueError:
                pass
        
        detection_timestamp = datetime.now()
        if data.get("detection_timestamp"):
            try:
                detection_timestamp = datetime.fromisoformat(data["detection_timestamp"])
            except (ValueError, TypeError):
                pass
        
        review_timestamp = None
        if data.get("review_timestamp"):
            try:
                review_timestamp = datetime.fromisoformat(data["review_timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            issue_id=data.get("issue_id", str(uuid4())),
            issue_type=issue_type,
            severity=severity,
            title=data.get("title", ""),
            description=data.get("description", ""),
            affected_device_id=data.get("affected_device_id"),
            affected_student_id=data.get("affected_student_id"),
            affected_screening_id=data.get("affected_screening_id"),
            affected_log_id=data.get("affected_log_id"),
            affected_certificate_id=data.get("affected_certificate_id"),
            detection_timestamp=detection_timestamp,
            review_status=review_status,
            review_notes=data.get("review_notes"),
            reviewer=data.get("reviewer"),
            review_timestamp=review_timestamp,
            details=data.get("details", {}),
            source_file=data.get("source_file")
        )
