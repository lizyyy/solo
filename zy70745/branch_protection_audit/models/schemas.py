from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class AuditLevel(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ValidationStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    SKIP = "SKIP"


class SourceLocation(BaseModel):
    file_path: str
    sheet_name: Optional[str] = None
    line_number: Optional[int] = None
    row_index: Optional[int] = None
    raw_content: str = ""

    def get_location_str(self) -> str:
        parts = [self.file_path]
        if self.sheet_name:
            parts.append(f"Sheet:{self.sheet_name}")
        if self.line_number:
            parts.append(f"Line:{self.line_number}")
        if self.row_index:
            parts.append(f"Row:{self.row_index}")
        return " | ".join(parts)


class Repository(BaseModel):
    id: str
    name: str
    url: Optional[str] = None
    source: SourceLocation

    def __hash__(self):
        return hash(self.id)


class BranchRule(BaseModel):
    id: str
    repository_id: str
    branch_pattern: str
    is_protected: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    source: SourceLocation

    def __hash__(self):
        return hash(self.id)


class ExceptionApplication(BaseModel):
    id: str
    repository_id: str
    branch_pattern: str
    applicant: str
    approver: Optional[str] = None
    reason: str
    requested_at: datetime
    status: str
    source: SourceLocation

    def __hash__(self):
        return hash(self.id)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {"APPROVED", "REJECTED", "PENDING", "CANCELLED"}
        if v.upper() not in valid_statuses:
            raise ValueError(f"Invalid status: {v}. Must be one of {valid_statuses}")
        return v.upper()


class ProtectionWindow(BaseModel):
    id: str
    exception_id: str
    start_time: datetime
    end_time: datetime
    actual_end_time: Optional[datetime] = None
    is_active: bool = False
    source: SourceLocation

    def __hash__(self):
        return hash(self.id)

    @property
    def duration_hours(self) -> float:
        end = self.actual_end_time or self.end_time
        delta = end - self.start_time
        return delta.total_seconds() / 3600


class RecoveryAction(BaseModel):
    id: str
    window_id: str
    recovered_by: str
    recovered_at: datetime
    recovery_method: str
    is_successful: bool
    source: SourceLocation

    def __hash__(self):
        return hash(self.id)


class ValidationResult(BaseModel):
    rule_id: str
    rule_name: str
    status: ValidationStatus
    level: AuditLevel
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    related_records: List[str] = Field(default_factory=list)


class AuditRecord(BaseModel):
    record_id: str
    record_type: str
    repository_name: str
    branch_pattern: str
    applicant: Optional[str] = None
    approver: Optional[str] = None
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    recovered_by: Optional[str] = None
    recovered_at: Optional[datetime] = None
    validations: List[ValidationResult] = Field(default_factory=list)
    source: SourceLocation

    @property
    def overall_status(self) -> ValidationStatus:
        if any(v.status == ValidationStatus.FAIL for v in self.validations):
            return ValidationStatus.FAIL
        if any(v.status == ValidationStatus.WARN for v in self.validations):
            return ValidationStatus.WARN
        if all(v.status == ValidationStatus.SKIP for v in self.validations):
            return ValidationStatus.SKIP
        return ValidationStatus.PASS


class ParseResult(BaseModel):
    repositories: List[Repository] = Field(default_factory=list)
    branch_rules: List[BranchRule] = Field(default_factory=list)
    exceptions: List[ExceptionApplication] = Field(default_factory=list)
    windows: List[ProtectionWindow] = Field(default_factory=list)
    recoveries: List[RecoveryAction] = Field(default_factory=list)
    parse_errors: List[Dict[str, Any]] = Field(default_factory=list)


class AuditConclusion(BaseModel):
    audit_id: str
    generated_at: datetime
    total_records: int
    pass_count: int
    warn_count: int
    fail_count: int
    skip_count: int
    records: List[AuditRecord] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
