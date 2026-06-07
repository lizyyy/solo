from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class RecordStatus(str, Enum):
    SUCCESS = "success"
    TIME_LEAKAGE_SUSPECTED = "time_leakage_suspected"
    OLD_CALIBER_SUPPLEMENTED = "old_caliber_supplemented"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"


@dataclass
class EvalSlice:
    slice_id: str
    slice_name: str
    created_at: datetime
    raw_remark: str
    data_points: List[Dict[str, Any]] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)


@dataclass
class ParamsYaml:
    yaml_id: str
    file_path: str
    imported_at: datetime
    content: Dict[str, Any]
    raw_content: str


@dataclass
class ManualCorrection:
    correction_id: str
    created_at: datetime
    operator: str
    correction_type: str
    before_value: Any
    after_value: Any
    reason: str
    target_record_id: str


@dataclass
class RerunRecord:
    rerun_id: str
    original_record_id: str
    triggered_at: datetime
    triggered_by: str
    params_snapshot: Dict[str, Any]
    result_before: Dict[str, Any]
    result_after: Dict[str, Any]


@dataclass
class AnomalySample:
    sample_id: str
    record_id: str
    features: Dict[str, Any]
    predicted: float
    actual: float
    anomaly_score: float
    is_from_eval_slice: bool = False
    source_slice_id: Optional[str] = None


@dataclass
class RollbackRecord:
    record_id: str
    model_version: str
    training_window_start: datetime
    training_window_end: datetime
    eval_window_start: datetime
    eval_window_end: datetime
    metrics: Dict[str, float]
    status: RecordStatus
    created_at: datetime
    created_by: str
    params_yaml_id: Optional[str] = None
    eval_slice_ids: List[str] = field(default_factory=list)
    manual_correction_ids: List[str] = field(default_factory=list)
    rerun_ids: List[str] = field(default_factory=list)
    anomaly_sample_ids: List[str] = field(default_factory=list)
    review_note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    raw_remarks: str = ""
