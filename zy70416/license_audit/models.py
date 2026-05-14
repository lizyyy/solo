from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum
import uuid


class DetectionStatus(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    PENDING = "pending"


class ManualStatus(Enum):
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


@dataclass
class SourceLocation:
    file_path: str
    line_number: Optional[int] = None
    column: Optional[int] = None
    raw_context: Optional[str] = None


@dataclass
class Dependency:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    version: str = ""
    license: str = ""
    source: str = ""
    environment_name: str = ""
    source_location: Optional[SourceLocation] = None
    raw_input: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DetectionRule:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    pattern: str = ""
    is_overbroad: bool = False
    severity: str = "medium"
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class FieldError:
    field_name: str
    error_message: str
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    source_location: Optional[SourceLocation] = None


@dataclass
class AuditRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    dependency_id: str = ""
    dependency_name: str = ""
    environment_name: str = ""
    detection_rule_id: str = ""
    detection_rule_name: str = ""
    system_status: DetectionStatus = DetectionStatus.PENDING
    system_reason: str = ""
    manual_status: Optional[ManualStatus] = None
    manual_remark: str = ""
    operator: str = ""
    field_errors: List[FieldError] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class EvidenceItem:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    audit_record_id: str = ""
    field_name: str = ""
    original_value: str = ""
    source_location: Optional[SourceLocation] = None
    evidence_type: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AuditResult:
    total_dependencies: int = 0
    pass_count: int = 0
    fail_count: int = 0
    warning_count: int = 0
    pending_count: int = 0
    records: List[AuditRecord] = field(default_factory=list)
    evidences: List[EvidenceItem] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
