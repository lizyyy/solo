from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum


class ConflictStatus(Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"


class ScoreBucketDiff(Enum):
    NONE = "无差异"
    ONE_BUCKET = "差一个桶"
    MORE_THAN_ONE = "差多个桶"


@dataclass
class ParameterYAML:
    experiment_id: str
    experiment_name: str
    version: str
    import_time: datetime
    parameters: Dict[str, Any]
    metrics: Dict[str, float]
    conclusion: str
    raw_content: str
    is_valid: bool = True


@dataclass
class EvaluationSlice:
    slice_id: str
    experiment_id: str
    upload_time: datetime
    uploader: str
    metrics: Dict[str, float]
    score_distribution: Dict[str, int]
    notes: str
    source: str


@dataclass
class ConflictEvidence:
    conflict_id: str
    experiment_id: str
    field_name: str
    yaml_value: Any
    slice_value: Any
    description: str
    detected_time: datetime
    status: ConflictStatus = ConflictStatus.PENDING
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None


@dataclass
class ExperimentComparison:
    experiment_id: str
    experiment_name: str
    yaml_metrics: Dict[str, float]
    slice_metrics: Dict[str, float]
    metric_diffs: Dict[str, float]
    score_bucket_diff: ScoreBucketDiff
    conflicts: List[ConflictEvidence]
    last_update_time: datetime


@dataclass
class HistoryRecord:
    record_id: str
    experiment_id: str
    action: str
    operator: str
    timestamp: datetime
    details: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowState:
    experiment_id: str
    step: int
    step_name: str
    parameters_imported: bool
    slice_reviewed: bool
    comparison_updated: bool
    pending_review_items: List[str] = field(default_factory=list)
