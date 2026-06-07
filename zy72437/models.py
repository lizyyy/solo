from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class RecordSource(Enum):
    SIGN_IN_PHOTO = "sign_in_photo"
    TICKET_EXPORT = "ticket_export"
    MANUAL_CONFIRM = "manual_confirm"


class RecordStatus(Enum):
    PENDING_REVIEW = "pending_review"
    CONFLICT = "conflict"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NORMAL = "normal"


class ConflictType(Enum):
    SONG_NAME_MISMATCH = "song_name_mismatch"
    ATTENDANCE_MISMATCH = "attendance_mismatch"
    DATE_MISMATCH = "date_mismatch"
    DUPLICATE_RECORD = "duplicate_record"


class SelfCheckType(Enum):
    DUPLICATE_IMPORT = "duplicate_import"
    SONG_NAME_ALIAS = "song_name_alias"
    RECALC_AFTER_UPDATE = "recalc_after_update"
    EXPORT_CONSISTENCY = "export_consistency"


@dataclass
class CalculationMeta:
    param_version: str
    decision_reason: str
    calculated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ConflictEvidence:
    conflict_id: str
    conflict_type: ConflictType
    field_name: str
    sign_in_value: Any
    ticket_value: Any
    description: str
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None


@dataclass
class AuditLog:
    log_id: str
    record_id: str
    source: RecordSource
    action: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    operator: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    remark: Optional[str] = None


@dataclass
class SelfCheckResult:
    check_id: str
    check_type: SelfCheckType
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    checked_at: datetime = field(default_factory=datetime.now)


@dataclass
class ClaimRecord:
    record_id: str
    lesson_date: str
    teacher: str
    student: str
    song_live_name: Optional[str] = None
    song_copyright_name: Optional[str] = None
    attendance_count: Optional[int] = None
    raw_remark: str = ""
    status: RecordStatus = RecordStatus.PENDING_REVIEW
    source: RecordSource = RecordSource.SIGN_IN_PHOTO
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    calculation_meta: Optional[CalculationMeta] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None
    ticket_imported: bool = False
    weekly_report_generated: bool = False


@dataclass
class WorkflowState:
    workflow_id: str
    step: int
    sign_in_photo_imported: bool = False
    ticket_export_complemented: bool = False
    weekly_report_updated: bool = False
    current_records: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
