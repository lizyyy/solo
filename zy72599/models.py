from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum


class WeightStatus(str, Enum):
    NORMAL = "normal"
    THRESHOLD_CHANGED_REPORT_OLD = "threshold_changed_report_old"
    FROM_TRAINING_LOG = "from_training_log"
    PENDING_REVIEW = "pending_review"
    CONFLICT = "conflict"


class ReviewDecision(str, Enum):
    CONFIRM = "confirm"
    REJECT = "reject"
    PENDING = "pending"


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    version: str
    create_time: datetime
    weight_threshold: float
    weight_threshold_version: str
    features: Dict[str, float]
    source: str


@dataclass
class TrainingLogCurve:
    log_id: str
    snapshot_id: str
    train_time: datetime
    metric_name: str
    metric_values: List[float]
    epochs: List[int]
    final_weight: float
    weight_caliber: str
    remarks: str = ""


@dataclass
class StratifiedMetric:
    metric_name: str
    segment: str
    value: float
    confidence: float
    caliber: str
    update_time: datetime
    source: str


@dataclass
class ConflictEvidence:
    field: str
    snapshot_value: str
    log_value: str
    description: str


@dataclass
class WeightTrackRecord:
    track_id: str
    snapshot_id: str
    feature_snapshot: Optional[FeatureSnapshot] = None
    training_log: Optional[TrainingLogCurve] = None
    status: WeightStatus = WeightStatus.PENDING_REVIEW
    stratified_metrics: List[StratifiedMetric] = field(default_factory=list)
    history: List[Dict] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    review_decision: ReviewDecision = ReviewDecision.PENDING
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    review_comment: str = ""
    create_time: datetime = field(default_factory=datetime.now)
    update_time: datetime = field(default_factory=datetime.now)

    def add_history(self, step: str, action: str, operator: str, detail: str):
        self.history.append({
            "step": step,
            "action": action,
            "operator": operator,
            "detail": detail,
            "time": datetime.now().isoformat()
        })
        self.update_time = datetime.now()


@dataclass
class ReviewPackage:
    track_id: str
    snapshot_id: str
    conflicts: List[ConflictEvidence]
    snapshot_summary: Dict
    log_summary: Dict
    decision: ReviewDecision = ReviewDecision.PENDING
