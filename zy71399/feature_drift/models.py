from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class FeatureType(str, Enum):
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"


class AlertLevel(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class OnlineFeature:
    sample_id: str
    feature_name: str
    feature_value: Any
    model_version: str
    timestamp: str
    business_label: str = ""
    _raw_row: Optional[Dict[str, Any]] = field(default=None, repr=False)

    def identity_key(self) -> str:
        raw = f"{self.sample_id}|{self.feature_name}"
        return hashlib.md5(raw.encode("utf-8")).hexdigest()


@dataclass
class NumericStats:
    mean: float
    std: float
    min_val: float
    max_val: float
    percentiles: Dict[str, float] = field(default_factory=dict)
    missing_rate: float = 0.0


@dataclass
class CategoricalStats:
    value_counts: Dict[str, int]
    total_count: int
    missing_rate: float = 0.0


@dataclass
class TrainingBaseline:
    feature_name: str
    feature_type: FeatureType
    numeric_stats: Optional[NumericStats] = None
    categorical_stats: Optional[CategoricalStats] = None
    sample_size: int = 0
    model_version: str = ""

    def get_missing_rate(self) -> float:
        if self.feature_type == FeatureType.NUMERIC and self.numeric_stats:
            return self.numeric_stats.missing_rate
        if self.feature_type == FeatureType.CATEGORICAL and self.categorical_stats:
            return self.categorical_stats.missing_rate
        return 0.0


@dataclass
class ModelVersion:
    version: str
    description: str = ""
    deploy_date: str = ""


@dataclass
class SampleWindow:
    window_id: str
    start_date: str
    end_date: str
    sample_count: int
    min_recommended: int = 200

    def is_too_short(self) -> bool:
        return self.sample_count < self.min_recommended


@dataclass
class BusinessLabel:
    label_name: str
    description: str = ""


@dataclass
class DriftResult:
    feature_name: str
    feature_type: FeatureType
    drift_metric: float
    metric_name: str
    is_drifted: bool
    baseline_missing_rate: float = 0.0
    online_missing_rate: float = 0.0
    missing_rate_delta: float = 0.0
    model_version: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AlertItem:
    feature_name: str
    level: AlertLevel
    category: str
    message: str
    explanation: str
    drift_metric: Optional[float] = None
    model_version: str = ""


@dataclass
class VersionSliceResult:
    version: str
    feature_results: List[DriftResult] = field(default_factory=list)
    sample_count: int = 0
    has_drift: bool = False


@dataclass
class WindowIssue:
    window_id: str
    issue_type: str
    severity: AlertLevel
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DriftReport:
    report_id: str
    generated_at: str
    feature_results: List[DriftResult] = field(default_factory=list)
    alerts: List[AlertItem] = field(default_factory=list)
    version_slices: List[VersionSliceResult] = field(default_factory=list)
    window_issues: List[WindowIssue] = field(default_factory=list)
    needs_manual_review: List[str] = field(default_factory=list)
    dedup_log: List[str] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    @staticmethod
    def make_report_id() -> str:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        suffix = hashlib.md5(ts.encode()).hexdigest()[:6]
        return f"drift-{ts}-{suffix}"
