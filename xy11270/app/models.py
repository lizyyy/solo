from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ViolationType(str, Enum):
    MISSING_APOLOGY = "missing_apology"
    MISSING_REFUND_PROMISE = "missing_refund_promise"
    SENSITIVE_WORD = "sensitive_word"
    MISSING_SPEAKER = "missing_speaker"
    TIMESTAMP_OVERLAP = "timestamp_overlap"


class TranscriptSegment(BaseModel):
    speaker: Optional[str] = None
    text: str
    start_time: float = Field(ge=0)
    end_time: float = Field(ge=0)


class TranscriptRequest(BaseModel):
    transcript_id: str
    segments: List[TranscriptSegment]
    metadata: Optional[Dict[str, Any]] = None


class Violation(BaseModel):
    type: ViolationType
    message: str
    severity: str = "medium"
    segment_index: Optional[int] = None
    details: Optional[Dict[str, Any]] = None


class ScanResult(BaseModel):
    transcript_id: str
    scanned_at: datetime
    violations: List[Violation]
    passed: bool
    review_required: bool
    rule_version: str
    scan_details: Dict[str, Any]


class ReviewRequest(BaseModel):
    transcript_id: str
    status: ReviewStatus
    reviewer: str
    comment: Optional[str] = None


class SummaryStats(BaseModel):
    total_scanned: int
    passed: int
    failed: int
    pending_review: int
    violations_by_type: Dict[str, int]


class ExportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_all: bool = False
