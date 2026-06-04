from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
import uuid


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MIXED_FORMAT = "mixed_format"
    SUPPLEMENTARY = "supplementary"
    PENDING_REVIEW = "pending_review"
    CONFLICT_DETECTED = "conflict_detected"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    PROCESSED = "processed"


class FormulaSource(str, Enum):
    SCREENSHOT = "旧公式截图"
    TEACHER_COMMENT = "老师批注"
    SUPPLEMENTARY = "补录口径"


@dataclass
class ValueEntry:
    raw_value: str
    numeric_value: Optional[float] = None
    is_percentage: bool = False
    is_decimal: bool = False
    format_note: Optional[str] = None


@dataclass
class Formula:
    expression: str
    source: FormulaSource
    description: str
    source_id: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    uploaded_by: Optional[str] = None


@dataclass
class ConflictEvidence:
    record_id: str
    field_name: str
    screenshot_value: Optional[str]
    comment_value: Optional[str]
    detail: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ReviewResult:
    record_id: str
    reviewer: str
    decision: RecordStatus
    comment: Optional[str] = None
    reviewed_at: datetime = field(default_factory=datetime.now)


@dataclass
class CalculationDetail:
    step: int
    description: str
    input_values: Dict[str, Any]
    formula_used: str
    intermediate_result: float
    source: FormulaSource


@dataclass
class DriftRecord:
    batch_id: str
    subject: str
    exam_date: str
    original_values: Dict[str, ValueEntry]
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    covariance_result: Optional[float] = None
    status: RecordStatus = RecordStatus.NORMAL
    formulas: List[Formula] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    reviews: List[ReviewResult] = field(default_factory=list)
    calculation_history: List[CalculationDetail] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None


@dataclass
class MonitorSession:
    session_id: str = field(default_factory=lambda: f"session-{uuid.uuid4().hex[:8]}")
    started_at: datetime = field(default_factory=datetime.now)
    ended_at: Optional[datetime] = None
    operator: Optional[str] = None
    records: List[DriftRecord] = field(default_factory=list)
    replay_commands: List[str] = field(default_factory=list)
    audit_log: List[Dict[str, Any]] = field(default_factory=list)

    def log_action(self, action: str, detail: Dict[str, Any]) -> None:
        self.audit_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "detail": detail,
        })
