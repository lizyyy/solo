from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Tuple
from pydantic import BaseModel, Field, validator


class ReviewStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NEEDS_DATA_SCIENTIST = "needs_data_scientist"


class ConflictType(str, Enum):
    LABEL_MISMATCH = "label_mismatch"
    SCORE_MISMATCH = "score_mismatch"
    THRESHOLD_MISMATCH = "threshold_mismatch"
    SAMPLE_MISSING = "sample_missing"


class ThresholdHistory(BaseModel):
    threshold: float
    report_value: Optional[float] = None
    changed_at: datetime = Field(default_factory=datetime.now)
    changed_by: str
    reason: str

    @property
    def has_mismatch(self) -> bool:
        return self.report_value is not None and abs(self.threshold - self.report_value) > 1e-9


class SampleLabel(BaseModel):
    model_config = {"protected_namespaces": ()}

    sample_id: str
    predicted_label: int
    predicted_score: float
    true_label: Optional[int] = None
    source: str
    model_version: str
    params_version: str
    params_reason: str = ""


class ExperimentBucket(BaseModel):
    bucket_id: str
    name: str
    imported_at: datetime = Field(default_factory=datetime.now)
    imported_by: str
    samples: List[SampleLabel] = Field(default_factory=list)
    threshold_history: List[ThresholdHistory] = Field(default_factory=list)
    current_threshold: float = 0.5
    is_supplemented: bool = False

    def get_latest_threshold(self) -> ThresholdHistory:
        return self.threshold_history[-1] if self.threshold_history else ThresholdHistory(
            threshold=self.current_threshold,
            changed_by="system",
            reason="initial"
        )


class NegativeSample(BaseModel):
    sample_id: str
    true_label: int
    source: str
    added_at: datetime = Field(default_factory=datetime.now)
    added_by: str


class ConflictEvidence(BaseModel):
    sample_id: str
    conflict_type: ConflictType
    experiment_value: Any
    negative_value: Any
    description: str


class SelfCheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class UnifiedResult(BaseModel):
    result_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    experiment_bucket_id: str
    samples: List[SampleLabel]
    stratified_metrics: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    threshold: float
    threshold_report_value: Optional[float] = None
    self_check_results: List[SelfCheckResult] = Field(default_factory=list)
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_comment: str = ""
    needs_data_scientist: bool = False
    data_scientist_comment: str = ""
    params_version: str = ""
    params_reason: str = ""

    def is_consistent(self) -> bool:
        if self.threshold_report_value is None:
            return True
        return abs(self.threshold - self.threshold_report_value) <= 1e-9


class ReviewRecord(BaseModel):
    record_id: str
    result_id: str
    reviewer: str
    decision: ReviewStatus
    comment: str
    reviewed_at: datetime = Field(default_factory=datetime.now)
    step: int
