from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Tuple
import uuid
import copy


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MIXED_FORMAT = "mixed_format"
    SUPPLEMENTARY = "supplementary"
    PENDING_REVIEW = "pending_review"
    CONFLICT_DETECTED = "conflict_detected"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    PROCESSED = "processed"
    RECALCULATED = "recalculated"


class FormulaSource(str, Enum):
    SCREENSHOT = "旧公式截图"
    TEACHER_COMMENT = "老师批注"
    SUPPLEMENTARY = "补录口径"


class ReviewField(str, Enum):
    FORMAT = "数据格式"
    FORMULA = "计算公式"
    VALUE = "数值取值"


@dataclass
class ValueEntry:
    raw_value: str
    numeric_value: Optional[float] = None
    is_percentage: bool = False
    is_decimal: bool = False
    format_note: Optional[str] = None

    def clone(self) -> "ValueEntry":
        return ValueEntry(
            raw_value=self.raw_value,
            numeric_value=self.numeric_value,
            is_percentage=self.is_percentage,
            is_decimal=self.is_decimal,
            format_note=self.format_note,
        )


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
class ValueChange:
    field_name: str
    original_statement: str
    original_numeric: Optional[float]
    revised_statement: str
    revised_numeric: Optional[float]
    change_reason: str


@dataclass
class ReviewResult:
    record_id: str
    reviewer: str
    review_field: ReviewField
    decision: RecordStatus
    comment: Optional[str] = None
    value_changes: List[ValueChange] = field(default_factory=list)
    next_handler: Optional[str] = None
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
class CalculationSnapshot:
    snapshot_id: str = field(default_factory=lambda: f"snap-{uuid.uuid4().hex[:8]}")
    created_at: datetime = field(default_factory=datetime.now)
    label: str = ""
    formula_source: FormulaSource = FormulaSource.SCREENSHOT
    formula_expression: str = ""
    values_snapshot: Dict[str, ValueEntry] = field(default_factory=dict)
    details: List[CalculationDetail] = field(default_factory=list)
    covariance_result: Optional[float] = None
    status_at_snapshot: RecordStatus = RecordStatus.NORMAL

    def diff_with(self, other: "CalculationSnapshot") -> Dict[str, Any]:
        return {
            "result_diff": (
                self.covariance_result - other.covariance_result
                if self.covariance_result is not None and other.covariance_result is not None
                else None
            ),
            "formula_changed": self.formula_expression != other.formula_expression,
            "formula_this": self.formula_expression,
            "formula_other": other.formula_expression,
            "source_this": self.formula_source.value,
            "source_other": other.formula_source.value,
            "label_this": self.label,
            "label_other": other.label,
        }


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
    calculation_snapshots: List[CalculationSnapshot] = field(default_factory=list)
    calculation_history: List[CalculationDetail] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None

    def snapshot_values(self) -> Dict[str, ValueEntry]:
        return {k: v.clone() for k, v in self.original_values.items()}

    def take_calculation_snapshot(
        self,
        label: str,
        source: FormulaSource,
        formula_expr: str,
        details: List[CalculationDetail],
        result: Optional[float],
    ) -> CalculationSnapshot:
        snap = CalculationSnapshot(
            label=label,
            formula_source=source,
            formula_expression=formula_expr,
            values_snapshot=self.snapshot_values(),
            details=copy.deepcopy(details),
            covariance_result=result,
            status_at_snapshot=self.status,
        )
        self.calculation_snapshots.append(snap)
        self.calculation_history = copy.deepcopy(details)
        self.covariance_result = result
        return snap

    def get_latest_snapshot(self) -> Optional[CalculationSnapshot]:
        return self.calculation_snapshots[-1] if self.calculation_snapshots else None

    def get_old_vs_new_diff(self) -> Optional[Dict[str, Any]]:
        if len(self.calculation_snapshots) >= 2:
            return self.calculation_snapshots[-1].diff_with(self.calculation_snapshots[0])
        return None


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
