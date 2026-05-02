from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field, validator


class FileType(str, Enum):
    POSITION_TABLE = "position_table"
    SCAN_LOG = "scan_log"
    TEMPERATURE = "temperature"
    TRANSFER_FORM = "transfer_form"


class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationRule(str, Enum):
    DUPLICATE_BARCODE = "duplicate_barcode"
    INVALID_POSITION = "invalid_position"
    POSITION_MISMATCH = "position_mismatch"
    MISSING_SCAN = "missing_scan"
    UNEXPECTED_SCAN = "unexpected_scan"
    TEMPERATURE_EXCEEDED = "temperature_exceeded"
    TEMPERATURE_NOT_MARKED = "temperature_not_marked"
    MISSING_SIGNATURE = "missing_signature"
    INCOMPLETE_TRANSFER_CHAIN = "incomplete_transfer_chain"


class IngestedFile(BaseModel):
    file_type: FileType
    original_path: str
    file_name: str
    file_hash: str
    ingest_time: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    row_count: int = 0


class SamplePosition(BaseModel):
    barcode: str
    box_id: str
    row: int
    col: int
    position_str: str
    batch_id: Optional[str] = None
    sample_type: Optional[str] = None

    @validator('row', 'col')
    def must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Position must be non-negative')
        return v


class ScanLogEntry(BaseModel):
    barcode: str
    scan_time: datetime
    scanner_id: Optional[str] = None
    location: Optional[str] = None
    box_id: Optional[str] = None


class TemperatureReading(BaseModel):
    timestamp: datetime
    temperature: float
    freezer_id: str
    probe_id: Optional[str] = None
    is_alert: bool = False
    alert_marked: bool = False


class TransferForm(BaseModel):
    transfer_id: str
    transfer_date: datetime
    sender_name: str
    sender_signature: Optional[str] = None
    sender_sign_date: Optional[datetime] = None
    receiver_name: str
    receiver_signature: Optional[str] = None
    receiver_sign_date: Optional[datetime] = None
    box_ids: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class ValidationIssue(BaseModel):
    rule: ValidationRule
    severity: ValidationSeverity
    message: str
    affected_samples: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)


class ReviewEntry(BaseModel):
    review_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    reviewer_name: str
    issue_reference: Optional[str] = None
    action_taken: str
    comments: Optional[str] = None
    resolution_status: str
    session_id: str


class AuditSession(BaseModel):
    session_id: str
    created_at: datetime = Field(default_factory=datetime.now)
    ingested_files: List[IngestedFile] = Field(default_factory=list)
    sample_positions: List[SamplePosition] = Field(default_factory=list)
    scan_logs: List[ScanLogEntry] = Field(default_factory=list)
    temperature_readings: List[TemperatureReading] = Field(default_factory=list)
    transfer_form: Optional[TransferForm] = None
    validation_issues: List[ValidationIssue] = Field(default_factory=list)
    review_entries: List[ReviewEntry] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
