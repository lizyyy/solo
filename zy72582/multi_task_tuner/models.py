from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class RecordStatus(Enum):
    PENDING = "pending"
    NORMAL = "normal"
    TIME_WINDOW_LEAK = "time_window_leak"
    NEED_REVIEW = "need_review"
    OLD_METRIC = "old_metric"
    CORRECTED = "corrected"
    RERUN = "rerun"


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    created_at: datetime
    features: Dict[str, Any]
    data_range_start: datetime
    data_range_end: datetime
    source: str = "main_flow"


@dataclass
class TrainingLogPoint:
    timestamp: datetime
    epoch: int
    loss: float
    metrics: Dict[str, float]
    task_weights: Dict[str, float]


@dataclass
class TrainingLogCurve:
    log_id: str
    experiment_name: str
    points: List[TrainingLogPoint] = field(default_factory=list)
    data_source: str = "on_site"


@dataclass
class StatusHistoryItem:
    from_status: str
    to_status: str
    action: str
    timestamp: datetime
    note: Optional[str] = None
    actor: Optional[str] = None


@dataclass
class AnomalySample:
    sample_id: str
    snapshot_id: str
    log_id: Optional[str]
    detected_at: datetime
    status: RecordStatus
    metrics: Dict[str, float]
    original_metrics: Dict[str, float]
    flags: List[str] = field(default_factory=list)
    review_note: Optional[str] = None
    corrected_by: Optional[str] = None
    corrected_at: Optional[datetime] = None
    status_history: List[StatusHistoryItem] = field(default_factory=list)


@dataclass
class ExperimentRun:
    run_id: str
    run_type: str
    start_time: datetime
    end_time: Optional[datetime]
    task_weights: Dict[str, float]
    feature_snapshots: List[str] = field(default_factory=list)
    training_logs: List[str] = field(default_factory=list)
    anomaly_samples: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class ReviewRecord:
    record_id: str
    anomaly_sample_id: str
    reviewer: str
    action: str
    note: str
    timestamp: datetime
