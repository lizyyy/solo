from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RecordStatus(Enum):
    NORMAL = "normal"
    GAP_DETECTED = "gap_detected"
    OLD_CALIBER = "old_caliber"
    PENDING_REVIEW = "pending_review"
    PAUSED = "paused"
    TEACHING_REVIEW = "teaching_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    RESUMED = "resumed"


STATUS_LABEL_CN = {
    "normal": "正常",
    "gap_detected": "编号断档-待教研组复核",
    "old_caliber": "旧口径补录",
    "pending_review": "冲突待运营确认",
    "paused": "已暂停",
    "teaching_review": "教研组复核中",
    "confirmed": "已确认",
    "rejected": "已驳回",
    "resumed": "已续局",
}


class RecordSource(Enum):
    IMPORT = "import"
    MANUAL_FILL = "manual_fill"
    HAND_CALCULATION = "hand_calculation"


@dataclass
class StatusChange:
    from_status: str
    to_status: str
    operator: str
    reason: str
    changed_at: datetime = field(default_factory=datetime.now)
    original_value: Optional[float] = None
    new_value: Optional[float] = None
    next_handler: Optional[str] = None


@dataclass
class ReviewInfo:
    original_statement: str = ""
    corrected_value: Optional[float] = None
    processing_reason: str = ""
    next_handler: str = ""
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None


@dataclass
class PredictionRecord:
    record_id: int
    date: str
    store_id: str
    predicted_foot_traffic: float
    poisson_lambda: float
    status: RecordStatus
    source: RecordSource
    created_at: datetime = field(default_factory=datetime.now)
    version: str = "v1.0"
    notes: Optional[str] = None
    previous_version: Optional[str] = None
    original_predicted: Optional[float] = None
    original_lambda: Optional[float] = None
    state_history: List[StatusChange] = field(default_factory=list)
    review_info: ReviewInfo = field(default_factory=ReviewInfo)
    conflict_ids: List[str] = field(default_factory=list)
    gap_info: Optional[Dict[str, Any]] = None

    def record_status_change(self, change: StatusChange):
        self.state_history.append(change)


@dataclass
class ParameterVersion:
    version: str
    lambda_value: float
    effective_date: str
    created_by: str
    created_at: datetime = field(default_factory=datetime.now)
    reason: str = ""
    is_active: bool = True
    related_record_ids: List[int] = field(default_factory=list)
    tradeoff_note: str = ""


@dataclass
class HandCalculation:
    calc_id: str
    date: str
    store_id: str
    manual_value: float
    formula_used: str
    created_by: str
    created_at: datetime = field(default_factory=datetime.now)
    is_confirmed: bool = False
    linked_record_id: Optional[int] = None


@dataclass
class ConflictEvidence:
    conflict_id: str
    record_id: int
    parameter_value: float
    hand_calc_value: float
    description: str
    hand_calc_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    resolution: Optional[str] = None
    resolved_by: str = ""
    resolved_at: Optional[datetime] = None


@dataclass
class ProcessingLog:
    log_id: str
    record_id: int
    action: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExportRecord:
    record_id: int
    date: str
    store_id: str
    predicted_foot_traffic: float
    poisson_lambda: float
    status: str
    status_label: str
    source: str
    version: str
    notes: str
    original_predicted: Optional[float]
    original_lambda: Optional[float]
    review_original_statement: str
    review_corrected_value: Optional[float]
    review_processing_reason: str
    review_next_handler: str
    state_count: int
    has_gap: bool
    has_conflict: bool
