from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DataSource(str, Enum):
    ALARM_RECORD = "alarm_record"
    OLD_API_DOC = "old_api_doc"
    CALL_LOG = "call_log"


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    IDEMPOTENT_ISSUE = "idempotent_issue"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    CONFIRMED = "confirmed"
    AWAITING_SUPPLEMENT = "awaiting_supplement"
    MANUALLY_MODIFIED = "manually_modified"


class AlarmRecord(BaseModel):
    id: str
    alarm_time: datetime
    alarm_level: str
    alarm_content: str
    idempotent_key: Optional[str] = None
    source_system: str
    handler: Optional[str] = None
    api_endpoint: Optional[str] = None
    request_params: Optional[Dict[str, Any]] = None
    response_error: Optional[str] = None


class OldApiDoc(BaseModel):
    id: str
    api_name: str
    api_endpoint: str
    http_method: str
    version: str
    deprecated_date: datetime
    idempotent_key: Optional[str] = None
    request_schema: Optional[Dict[str, Any]] = None
    response_schema: Optional[Dict[str, Any]] = None
    owner: str
    remarks: Optional[str] = None


class CallLog(BaseModel):
    id: str
    call_time: datetime
    api_endpoint: str
    http_method: str
    request_params: Dict[str, Any]
    response_data: Optional[Dict[str, Any]] = None
    response_status: int
    duration_ms: int
    idempotent_key: Optional[str] = None
    caller_system: str
    success: bool
    error_message: Optional[str] = None


class TimelineItem(BaseModel):
    timestamp: datetime
    source: DataSource
    source_id: str
    title: str
    content: str
    idempotent_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    raw_data: Dict[str, Any]


class IdempotentIssue(BaseModel):
    idempotent_key: str
    source: DataSource
    issue_type: str
    description: str
    contact_person: str
    next_step: str


class AutoJudgment(BaseModel):
    judgment_type: str
    reason: str
    confidence: float
    evidence: List[str]
    suggestion: str


class TaskRetryRecord(BaseModel):
    task_id: str
    batch_id: str
    idempotent_key: Optional[str] = None
    api_endpoint: Optional[str] = None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    retry_count: int = 0
    auto_judgment: Optional[AutoJudgment] = None
    idempotent_issue: Optional[IdempotentIssue] = None
    manual_notes: Optional[str] = None
    last_attempt_at: Optional[datetime] = None
    last_error: Optional[str] = None
    related_alarm_ids: List[str] = Field(default_factory=list)
    related_api_doc_ids: List[str] = Field(default_factory=list)
    related_call_log_ids: List[str] = Field(default_factory=list)


class UnifiedView(BaseModel):
    idempotent_key: Optional[str] = None
    api_endpoint: str
    timeline: List[TimelineItem]
    latest_status: TaskStatus
    task_records: List[TaskRetryRecord]
    summary: str


class MigrationReport(BaseModel):
    report_id: str
    generated_at: datetime
    batch_id: str
    processing_policy: str
    total_records: int
    confirmed_count: int
    awaiting_supplement_count: int
    manually_modified_count: int
    success_count: int
    failed_count: int
    idempotent_issue_count: int
    details: Dict[str, Any]
