from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, validator


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    NEEDS_REVIEW = "needs_review"


class SuppressionSource(BaseModel):
    file_path: str
    line_number: int
    raw_content: str


class EvidenceSample(BaseModel):
    sample_id: str
    scan_rule_id: str
    file_path: str
    line_number: Optional[int] = None
    evidence_content: str
    timestamp: Optional[datetime] = None
    scan_tool: Optional[str] = None
    severity: Optional[str] = None


class SuppressionRule(BaseModel):
    rule_id: str
    scan_rule_id: str
    reason: str
    created_at: datetime
    expires_at: datetime
    created_by: str
    reviewer: Optional[str] = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    samples: List[EvidenceSample] = Field(default_factory=list)
    source: Optional[SuppressionSource] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("expires_at")
    def expires_at_must_be_after_created_at(cls, v, values):
        if "created_at" in values and v <= values["created_at"]:
            raise ValueError("expires_at must be after created_at")
        return v

    def is_expired(self, at_time: Optional[datetime] = None) -> bool:
        check_time = at_time or datetime.now()
        return check_time > self.expires_at

    def days_until_expiry(self, at_time: Optional[datetime] = None) -> int:
        check_time = at_time or datetime.now()
        delta = self.expires_at - check_time
        return max(0, delta.days)

    def can_be_reviewed(self) -> bool:
        return self.review_status in [ReviewStatus.PENDING, ReviewStatus.NEEDS_REVIEW]


class BadRow(BaseModel):
    file_path: str
    row_number: int
    raw_content: str
    error_message: str


class ReviewResult(BaseModel):
    rule_id: str
    original_status: ReviewStatus
    new_status: ReviewStatus
    reviewer: str
    review_comment: Optional[str] = None
    reviewed_at: datetime = Field(default_factory=datetime.now)
    risk_flags: List[str] = Field(default_factory=list)


class ProcessedData(BaseModel):
    valid_rules: List[SuppressionRule] = Field(default_factory=list)
    bad_rows: List[BadRow] = Field(default_factory=list)
    review_results: List[ReviewResult] = Field(default_factory=list)
    processing_timestamp: datetime = Field(default_factory=datetime.now)
