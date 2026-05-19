from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RollbackStatus(str, Enum):
    PENDING = "pending"
    AUTO_APPROVED = "auto_approved"
    AUTO_REJECTED = "auto_rejected"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    MANUAL_APPROVED = "manual_approved"
    MANUAL_REJECTED = "manual_rejected"
    EXECUTED = "executed"
    CANCELLED = "cancelled"


class MetricType(str, Enum):
    CORE = "core"
    AUXILIARY = "auxiliary"


class ErrorCode(str, Enum):
    MISSING_FIELDS = "missing_fields"
    INVALID_STATE = "invalid_state"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


class ErrorResponse(BaseModel):
    code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None


class ReleaseBatchBase(BaseModel):
    batch_id: str
    release_name: str
    version: str
    environment: str


class ReleaseBatchCreate(ReleaseBatchBase):
    pass


class ReleaseBatch(ReleaseBatchBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class MetricBase(BaseModel):
    metric_name: str
    metric_type: MetricType
    current_value: float
    baseline_value: float
    unit: str
    raw_data: Optional[str] = None


class MetricCreate(MetricBase):
    batch_id: str


class Metric(MetricBase):
    id: int
    batch_id: str
    timestamp: datetime
    aggregated: bool

    class Config:
        orm_mode = True


class ThresholdRuleBase(BaseModel):
    rule_name: str
    metric_name: str
    metric_type: MetricType
    threshold_type: str
    threshold_value: float
    comparison_operator: str
    weight: float = 1.0
    description: Optional[str] = None


class ThresholdRuleCreate(ThresholdRuleBase):
    pass


class ThresholdRule(ThresholdRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class DecisionDetailBase(BaseModel):
    metric_name: str
    current_value: float
    threshold_value: float
    passed: bool
    weight: float


class DecisionDetailCreate(DecisionDetailBase):
    pass


class DecisionDetail(DecisionDetailBase):
    id: int
    decision_id: int

    class Config:
        orm_mode = True


class DecisionRecordBase(BaseModel):
    batch_id: str


class DecisionRecordCreate(DecisionRecordBase):
    pass


class ManualOverride(BaseModel):
    decision: str
    operator: str
    reason: str


class DecisionRecord(BaseModel):
    id: int
    batch_id: str
    status: RollbackStatus
    auto_decision: str
    auto_confidence: float
    manual_decision: Optional[str] = None
    manual_operator: Optional[str] = None
    manual_reason: Optional[str] = None
    manual_timestamp: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    details: List[DecisionDetail] = []

    class Config:
        orm_mode = True


class RollbackSummaryBase(BaseModel):
    batch_id: str
    release_name: str
    version: str
    environment: str
    final_decision: str
    decision_method: str
    operator: Optional[str] = None
    reason: Optional[str] = None
    metrics_summary: Optional[str] = None


class RollbackSummaryCreate(RollbackSummaryBase):
    start_time: datetime
    end_time: datetime
    duration_seconds: int


class RollbackSummary(RollbackSummaryBase):
    id: int
    start_time: datetime
    end_time: datetime
    duration_seconds: int
    exported_at: datetime

    class Config:
        orm_mode = True


class MetricsAggregationRequest(BaseModel):
    batch_id: str


class ThresholdDecisionRequest(BaseModel):
    batch_id: str


class RollbackDecisionResponse(BaseModel):
    batch_id: str
    status: RollbackStatus
    auto_decision: str
    auto_confidence: float
    needs_manual_review: bool
    message: str


class SummaryExportResponse(BaseModel):
    summary_id: int
    batch_id: str
    export_url: str
    exported_at: datetime
