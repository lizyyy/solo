from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class RecordStatus(Enum):
    RAW = "raw"
    VALIDATED = "validated"
    IMPUTED = "imputed"
    REVIEWED = "reviewed"
    REWORK = "rework"
    APPROVED = "approved"
    REJECTED = "rejected"


class MissingType(Enum):
    NONE = "none"
    SINGLE_FIELD = "single_field"
    MULTI_FIELD = "multi_field"
    FULL_ROW = "full_row"


class Severity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class RoadConditionRecord:
    record_id: str
    timestamp: Optional[str] = None
    road_segment: Optional[str] = None
    congestion_level: Optional[float] = None
    weather: Optional[str] = None
    temperature: Optional[float] = None
    surface_condition: Optional[str] = None
    traffic_volume: Optional[int] = None
    source: str = "unknown"
    loaded_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ValidationIssue:
    record_id: str
    severity: Severity
    issue_type: str
    description: str
    original_value: Any = None
    suggestion: str = ""


@dataclass
class ImputationEvidence:
    record_id: str
    field_name: str
    missing_type: MissingType
    imputation_method: str
    reference_record_ids: List[str] = field(default_factory=list)
    confidence: float = 0.0
    reasoning: str = ""
    imputed_value: Any = None


@dataclass
class ProcessingSuggestion:
    record_id: str
    field_name: str
    suggestion_text: str
    action_type: str
    priority: str = "normal"


@dataclass
class ImputationResult:
    record_id: str
    original_record: RoadConditionRecord
    imputed_record: RoadConditionRecord
    evidences: List[ImputationEvidence] = field(default_factory=list)
    suggestions: List[ProcessingSuggestion] = field(default_factory=list)
    status: RecordStatus = RecordStatus.IMPUTED
    processed_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class ReviewDecision:
    record_id: str
    reviewer: str
    decision: str
    corrections: Dict[str, Any] = field(default_factory=dict)
    comment: str = ""
    reviewed_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class MetricSnapshot:
    run_id: str
    total_records: int
    missing_count: int
    imputed_count: int
    avg_confidence: float
    rejected_count: int = 0
    fields_imputed: Dict[str, int] = field(default_factory=dict)
    by_missing_type: Dict[str, int] = field(default_factory=dict)
    computed_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class AuditEntry:
    run_id: str
    record_id: str
    action: str
    actor: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class MetricDiff:
    metric_name: str
    previous_value: Any
    current_value: Any
    delta: Any
    cause: str
