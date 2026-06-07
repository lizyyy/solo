from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MINORITY_MASKED = "minority_masked"
    NEED_REVIEW = "need_review"
    FIXED = "fixed"
    OLD_CALIBER = "old_caliber"


class SliceSource(str, Enum):
    INITIAL_IMPORT = "initial_import"
    MANUAL_CORRECTION = "manual_correction"
    RERUN = "rerun"


@dataclass
class EvalSlice:
    slice_id: str
    slice_name: str
    category: str
    total_samples: int
    positive_samples: int
    negative_samples: int
    recall: float
    precision: float
    source: SliceSource
    created_at: datetime = field(default_factory=datetime.now)
    feature_snapshot_id: Optional[str] = None
    parent_slice_id: Optional[str] = None
    note: Optional[str] = None


@dataclass
class CoverageGapRecord:
    record_id: str
    slice_id: str
    total_recall: float
    slice_recall: float
    recall_gap: float
    minority_ratio: float
    status: RecordStatus
    is_minority_masked: bool
    created_at: datetime = field(default_factory=datetime.now)
    feature_snapshot_id: Optional[str] = None
    review_note: Optional[str] = None
    fixed_note: Optional[str] = None


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    snapshot_name: str
    threshold_config: Dict[str, Any]
    recall_target: float
    created_at: datetime = field(default_factory=datetime.now)
    note: Optional[str] = None


@dataclass
class ThresholdReplayResult:
    replay_id: str
    feature_snapshot_id: str
    slice_id: str
    original_recall: float
    replayed_recall: float
    recall_change: float
    applied_threshold: Dict[str, Any]
    created_at: datetime = field(default_factory=datetime.now)
    note: Optional[str] = None
