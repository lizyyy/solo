from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class IssueType(str, Enum):
    MISSING_APOLOGY = "missing_apology"
    MISSING_REFUND_PROMISE = "missing_refund_promise"
    SENSITIVE_WORD = "sensitive_word"
    BAD_RECORD = "bad_record"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class SensitiveWord(BaseModel):
    id: str
    word: str
    category: str = "general"
    severity: int = Field(ge=1, le=5, default=3)
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.now)


class CallMetadata(BaseModel):
    call_id: str
    agent_id: str
    agent_name: str
    customer_phone: str
    customer_name: str
    call_start_time: datetime
    call_duration: int
    call_type: str
    satisfaction_score: Optional[int] = None


class TranscriptionSegment(BaseModel):
    speaker: str
    start_time: float
    end_time: float
    text: str


class IssueLocation(BaseModel):
    line_number: Optional[int] = None
    start_index: Optional[int] = None
    end_index: Optional[int] = None
    segment_index: Optional[int] = None
    original_text: str


class Issue(BaseModel):
    id: str
    issue_type: IssueType
    location: IssueLocation
    description: str
    severity: int = Field(ge=1, le=5, default=3)
    suggested_fix: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class BadRecord(BaseModel):
    id: str
    source_file: str
    original_position: str
    error_type: str
    error_message: str
    raw_content: str
    suggested_fix: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class InspectionRecord(BaseModel):
    id: str
    call_id: str
    metadata: CallMetadata
    transcription: List[TranscriptionSegment]
    issues: List[Issue] = Field(default_factory=list)
    bad_records: List[BadRecord] = Field(default_factory=list)
    scanned_at: datetime = Field(default_factory=datetime.now)
    scan_version: str = "1.0"
    is_complete: bool = False
    imported_hash: str

    @validator('imported_hash')
    def hash_not_empty(cls, v):
        if not v:
            raise ValueError('imported_hash cannot be empty')
        return v


class InspectionSummary(BaseModel):
    total_records: int = 0
    total_issues: int = 0
    issues_by_type: Dict[IssueType, int] = Field(default_factory=dict)
    issues_by_severity: Dict[int, int] = Field(default_factory=dict)
    pending_review: int = 0
    confirmed_issues: int = 0
    rejected_issues: int = 0
    bad_records_count: int = 0
    top_sensitive_words: List[Dict[str, Any]] = Field(default_factory=list)
    scan_date_range: Optional[Dict[str, datetime]] = None


class ImportResult(BaseModel):
    success: bool
    message: str
    total_imported: int = 0
    skipped_duplicates: int = 0
    bad_records: int = 0
    record_ids: List[str] = Field(default_factory=list)


class ScanRequest(BaseModel):
    call_id: Optional[str] = None
    re_scan: bool = False


class MarkIssueRequest(BaseModel):
    issue_id: str
    review_status: ReviewStatus
    reviewer: str
    notes: Optional[str] = None


class ExportFormat(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"


class ExportRequest(BaseModel):
    format: ExportFormat = ExportFormat.CSV
    include_masked: bool = True
    filters: Optional[Dict[str, Any]] = None
