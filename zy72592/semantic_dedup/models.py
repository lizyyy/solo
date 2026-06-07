from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SampleStatus(str, Enum):
    NORMAL = "normal"
    MINORITY_MASKED = "minority_masked"
    NEED_ALGO_REVIEW = "need_algo_review"
    NEED_OP_REVIEW = "need_op_review"
    CONFIRMED = "confirmed"


class NextAction(str, Enum):
    ALGO_ENGINEER = "算法工程师"
    OPERATIONS = "评测运营小孟"
    NONE = "无需处理"


class RecallCandidate(BaseModel):
    sample_id: str
    content: str
    semantic_score: float
    category: str
    is_minority: bool = False
    status: SampleStatus = SampleStatus.NORMAL
    why_kept: Optional[str] = None
    missing_materials: List[str] = Field(default_factory=list)
    next_action: NextAction = NextAction.NONE


class ThresholdParams(BaseModel):
    dedup_threshold: float = Field(0.85)
    minority_weight: float = Field(1.2)
    overall_metric_weight: float = Field(1.0)
    minority_boost_enabled: bool = True
    min_minority_ratio: float = Field(0.05)


class ThresholdResult(BaseModel):
    sample_id: str
    original_score: float
    adjusted_score: float
    passed: bool
    status: SampleStatus
    why_kept: str
    missing_materials: List[str]
    next_action: NextAction
    is_minority: bool


class AuditLog(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str
    action: str
    field_changed: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    reason: str
    affected_samples: List[str] = Field(default_factory=list)


class TrialRun(BaseModel):
    run_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    params: ThresholdParams
    candidates: List[RecallCandidate]
    results: List[ThresholdResult]
    audit_logs: List[AuditLog] = Field(default_factory=list)
    is_manual_correction: bool = False


class PlaybackItem(BaseModel):
    sample_id: str
    content: str
    category: str
    original_score: float
    adjusted_score: float
    threshold: float
    passed: bool
    status: SampleStatus
    explanation: str
    missing_materials: List[str]
    next_action: NextAction
    is_minority: bool
    minority_note: Optional[str] = None


class PlaybackReport(BaseModel):
    run_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    params: ThresholdParams
    total_samples: int
    passed_count: int
    removed_count: int
    minority_masked_count: int
    items: List[PlaybackItem]
    summary: str
    next_steps: List[str]
