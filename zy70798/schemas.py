from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class TestStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    READY_FOR_CLEANUP = "ready_for_cleanup"
    REQUIRES_MANUAL_REVIEW = "requires_manual_review"
    CLEANED = "cleaned"


class ResultStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    FLAKY = "FLAKY"


class QuarantinedTestBase(BaseModel):
    test_name: str
    test_path: str
    quarantine_reason: str
    reason_category: Optional[str] = None
    owner: str
    owner_email: Optional[str] = None
    quarantine_date: datetime
    expiry_date: datetime
    notes: Optional[str] = None

    @validator('expiry_date')
    def expiry_date_must_be_after_quarantine(cls, v, values):
        if 'quarantine_date' in values and v <= values['quarantine_date']:
            raise ValueError('expiry_date must be after quarantine_date')
        return v


class QuarantinedTestCreate(QuarantinedTestBase):
    pass


class QuarantinedTestUpdate(BaseModel):
    quarantine_reason: Optional[str] = None
    reason_category: Optional[str] = None
    owner: Optional[str] = None
    owner_email: Optional[str] = None
    expiry_date: Optional[datetime] = None
    status: Optional[TestStatus] = None
    notes: Optional[str] = None


class TestResultUpdate(BaseModel):
    result: ResultStatus
    run_date: datetime
    build_url: Optional[str] = None


class QuarantinedTestResponse(QuarantinedTestBase):
    id: int
    last_run_date: Optional[datetime] = None
    last_run_result: Optional[str] = None
    last_run_build_url: Optional[str] = None
    consecutive_passes: int
    total_runs_since_quarantine: int
    status: str
    days_until_expiry: Optional[int] = None
    is_expired: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CleanupSuggestionResponse(BaseModel):
    test_id: int
    test_name: str
    test_path: str
    owner: str
    reason_category: str
    expiry_date: datetime
    days_until_expiry: int
    consecutive_passes: int
    suggestion: str
    action_type: str
    priority: str


class OwnerSummary(BaseModel):
    owner: str
    owner_email: Optional[str] = None
    total_tests: int
    expired_count: int
    expiring_soon_count: int
    ready_for_cleanup_count: int
    tests: List[QuarantinedTestResponse]


class CleanupReportResponse(BaseModel):
    id: int
    report_date: datetime
    total_quarantined: int
    expired: int
    expiring_soon: int
    ready_for_cleanup: int
    requires_manual_review: int
    suggestions: List[CleanupSuggestionResponse]
    by_owner: List[OwnerSummary]
    by_reason: Dict[str, int]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ErrorCodes:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    REQUIRES_MANUAL_REVIEW = "REQUIRES_MANUAL_REVIEW"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
