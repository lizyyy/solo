from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import hashlib
import json


class AlertStatus(Enum):
    PENDING_REVIEW = "pending_review"
    REVIEWING = "reviewing"
    CONFIRMED_DRIFT = "confirmed_drift"
    FALSE_ALARM = "false_alarm"
    RESOLVED = "resolved"
    NEEDS_RECHECK = "needs_recheck"


class ScoreBucket(Enum):
    VERY_LOW = "very_low"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"

    @classmethod
    def from_score(cls, score: float) -> "ScoreBucket":
        if score < 0.2:
            return cls.VERY_LOW
        elif score < 0.4:
            return cls.LOW
        elif score < 0.6:
            return cls.MEDIUM
        elif score < 0.8:
            return cls.HIGH
        else:
            return cls.VERY_HIGH

    @classmethod
    def bucket_distance(cls, b1: "ScoreBucket", b2: "ScoreBucket") -> int:
        order = list(cls)
        return abs(order.index(b1) - order.index(b2))


@dataclass
class FeatureScore:
    feature_name: str
    offline_score: float
    online_score: float
    offline_bucket: ScoreBucket = field(init=False)
    online_bucket: ScoreBucket = field(init=False)
    bucket_diff: int = field(init=False)

    def __post_init__(self):
        self.offline_bucket = ScoreBucket.from_score(self.offline_score)
        self.online_bucket = ScoreBucket.from_score(self.online_score)
        self.bucket_diff = ScoreBucket.bucket_distance(self.offline_bucket, self.online_bucket)


@dataclass
class TrainingLog:
    log_id: str
    experiment_name: str
    model_version: str
    feature_scores: List[FeatureScore]
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def content_hash(self) -> str:
        data = {
            "experiment_name": self.experiment_name,
            "model_version": self.model_version,
            "feature_scores": [
                {
                    "feature_name": fs.feature_name,
                    "offline_score": fs.offline_score,
                    "online_score": fs.online_score,
                }
                for fs in sorted(self.feature_scores, key=lambda x: x.feature_name)
            ],
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


@dataclass
class ThresholdNote:
    note_id: str
    feature_name: Optional[str]
    title: str
    content: str
    author: str
    timestamp: datetime = field(default_factory=datetime.now)
    related_log_ids: List[str] = field(default_factory=list)


@dataclass
class ChangeHistory:
    change_id: str
    alert_id: str
    field_name: str
    old_value: Any
    new_value: Any
    author: str
    timestamp: datetime = field(default_factory=datetime.now)
    change_type: str = "edit"


@dataclass
class AlertEvidence:
    training_log_id: str
    threshold_note_ids: List[str] = field(default_factory=list)
    experiment_comparison_ids: List[str] = field(default_factory=list)


@dataclass
class Alert:
    alert_id: str
    feature_name: str
    offline_score: float
    online_score: float
    offline_bucket: ScoreBucket
    online_bucket: ScoreBucket
    bucket_diff: int
    status: AlertStatus = AlertStatus.PENDING_REVIEW
    remark: str = ""
    evidence: AlertEvidence = field(default_factory=AlertEvidence)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    change_history: List[ChangeHistory] = field(default_factory=list)

    def update_remark(self, new_remark: str, author: str) -> ChangeHistory:
        from .storage import generate_id

        change = ChangeHistory(
            change_id=generate_id(),
            alert_id=self.alert_id,
            field_name="remark",
            old_value=self.remark,
            new_value=new_remark,
            author=author,
            change_type="edit",
        )
        self.remark = new_remark
        self.change_history.append(change)
        self.updated_at = datetime.now()
        return change

    def update_status(self, new_status: AlertStatus, author: str, reason: str = "") -> ChangeHistory:
        from .storage import generate_id

        change = ChangeHistory(
            change_id=generate_id(),
            alert_id=self.alert_id,
            field_name="status",
            old_value=self.status.value,
            new_value=new_status.value,
            author=author,
            change_type="status_change",
        )
        if reason:
            change.old_value = f"{self.status.value} | reason: {reason}"
        self.status = new_status
        self.change_history.append(change)
        self.updated_at = datetime.now()
        return change
