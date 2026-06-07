from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    IMPORTED = "imported"
    LOGS_REVIEWED = "logs_reviewed"
    METRICS_UPDATED = "metrics_updated"
    CONFIRMED_NORMAL = "confirmed_normal"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    NEEDS_REVIEW = "needs_review"
    THRESHOLD_MISMATCH = "threshold_mismatch"

    @classmethod
    def is_final(cls, status: "ProcessingStatus") -> bool:
        return status in {cls.CONFIRMED_NORMAL, cls.CONFIRMED_ABNORMAL}


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    original_line_number: int
    main_flow: str
    raw_data: Dict[str, Any]
    import_timestamp: datetime = field(default_factory=datetime.now)
    source_file: Optional[str] = None
    sheet_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["import_timestamp"] = self.import_timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FeatureSnapshot":
        d = d.copy()
        d["import_timestamp"] = datetime.fromisoformat(d["import_timestamp"])
        return cls(**d)


@dataclass
class TrainingLog:
    log_id: str
    snapshot_id: str
    on_site_statement: str
    curve_data: Dict[str, List[float]]
    review_timestamp: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewer_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.review_timestamp:
            d["review_timestamp"] = self.review_timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TrainingLog":
        d = d.copy()
        if d.get("review_timestamp"):
            d["review_timestamp"] = datetime.fromisoformat(d["review_timestamp"])
        return cls(**d)


@dataclass
class ThresholdChange:
    change_id: str
    field_name: str
    old_value: float
    new_value: float
    changed_by: str
    change_timestamp: datetime = field(default_factory=datetime.now)
    change_reason: Optional[str] = None
    report_still_shows_old: bool = False

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_timestamp"] = self.change_timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ThresholdChange":
        d = d.copy()
        d["change_timestamp"] = datetime.fromisoformat(d["change_timestamp"])
        return cls(**d)


@dataclass
class ManualChange:
    change_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    change_timestamp: datetime = field(default_factory=datetime.now)
    change_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_timestamp"] = self.change_timestamp.isoformat()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ManualChange":
        d = d.copy()
        d["change_timestamp"] = datetime.fromisoformat(d["change_timestamp"])
        return cls(**d)


@dataclass
class ScoringDifferenceRecord:
    record_id: str
    snapshot_id: str
    online_score: float
    offline_score: float
    difference: float
    percent_diff: float
    current_status: ProcessingStatus = ProcessingStatus.PENDING
    feature_snapshot: Optional[FeatureSnapshot] = None
    training_logs: List[TrainingLog] = field(default_factory=list)
    threshold_changes: List[ThresholdChange] = field(default_factory=list)
    manual_changes: List[ManualChange] = field(default_factory=list)
    tier_metrics: Optional[Dict[str, Any]] = None
    tier_metrics_updated_by: Optional[str] = None
    tier_metrics_updated_at: Optional[datetime] = None
    data_scientist_notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def has_threshold_mismatch(self) -> bool:
        return any(tc.report_still_shows_old for tc in self.threshold_changes)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["current_status"] = self.current_status.value
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        if self.tier_metrics_updated_at:
            d["tier_metrics_updated_at"] = self.tier_metrics_updated_at.isoformat()
        if self.feature_snapshot:
            d["feature_snapshot"] = self.feature_snapshot.to_dict()
        d["training_logs"] = [tl.to_dict() for tl in self.training_logs]
        d["threshold_changes"] = [tc.to_dict() for tc in self.threshold_changes]
        d["manual_changes"] = [mc.to_dict() for mc in self.manual_changes]
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ScoringDifferenceRecord":
        d = d.copy()
        d["current_status"] = ProcessingStatus(d["current_status"])
        d["created_at"] = datetime.fromisoformat(d["created_at"])
        d["updated_at"] = datetime.fromisoformat(d["updated_at"])
        if d.get("tier_metrics_updated_at"):
            d["tier_metrics_updated_at"] = datetime.fromisoformat(
                d["tier_metrics_updated_at"]
            )
        if d.get("feature_snapshot"):
            d["feature_snapshot"] = FeatureSnapshot.from_dict(d["feature_snapshot"])
        d["training_logs"] = [
            TrainingLog.from_dict(tl) for tl in d.get("training_logs", [])
        ]
        d["threshold_changes"] = [
            ThresholdChange.from_dict(tc) for tc in d.get("threshold_changes", [])
        ]
        d["manual_changes"] = [
            ManualChange.from_dict(mc) for mc in d.get("manual_changes", [])
        ]
        return cls(**d)


@dataclass
class AuditLog:
    record_id: str
    action: str
    actor: str
    log_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    old_status: Optional[ProcessingStatus] = None
    new_status: Optional[ProcessingStatus] = None
    details: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        if self.old_status:
            d["old_status"] = self.old_status.value
        if self.new_status:
            d["new_status"] = self.new_status.value
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AuditLog":
        d = d.copy()
        d["timestamp"] = datetime.fromisoformat(d["timestamp"])
        if d.get("old_status"):
            d["old_status"] = ProcessingStatus(d["old_status"])
        if d.get("new_status"):
            d["new_status"] = ProcessingStatus(d["new_status"])
        return cls(**d)
