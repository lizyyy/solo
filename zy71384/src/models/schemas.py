from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator

from .enums import DiagnosisStatus, BacklogCause, AlertLevel, EdgeCaseType


class QueueMetricsBase(BaseModel):
    queue_name: str
    timestamp: datetime
    backlog_count: int = 0
    backlog_growth_rate: Optional[float] = None
    production_rate: float = 0.0
    production_rate_avg_1h: Optional[float] = None
    production_rate_avg_24h: Optional[float] = None
    consumption_rate: float = 0.0
    consumption_rate_avg_1h: Optional[float] = None
    consumption_rate_avg_24h: Optional[float] = None
    dead_letter_count: int = 0
    dead_letter_increment: Optional[int] = None
    consumer_count: int = 0
    active_consumer_count: Optional[int] = None
    time_window_start: Optional[datetime] = None
    time_window_end: Optional[datetime] = None
    raw_data: Optional[Dict[str, Any]] = None


class QueueMetricsCreate(QueueMetricsBase):
    pass


class QueueMetricsResponse(QueueMetricsBase):
    id: int
    diagnosis_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConsumerLogBase(BaseModel):
    consumer_id: str
    timestamp: datetime
    log_level: Optional[str] = None
    message: str
    is_heartbeat: bool = False
    is_error: bool = False
    last_seen_offset: Optional[int] = None


class ConsumerLogCreate(ConsumerLogBase):
    pass


class ConsumerLogResponse(ConsumerLogBase):
    id: int
    diagnosis_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EdgeCaseDetectionBase(BaseModel):
    edge_case_type: EdgeCaseType
    human_readable_hint: str
    evidence: Optional[Dict[str, Any]] = None
    confidence: float = 0.0


class EdgeCaseDetectionResponse(EdgeCaseDetectionBase):
    id: int
    diagnosis_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BacklogAttribution(BaseModel):
    primary_cause: BacklogCause
    confidence: float
    evidence: List[Dict[str, Any]]
    contributing_factors: List[str]
    production_contribution: float
    consumption_contribution: float
    dead_letter_contribution: float
    consumer_offline_contribution: float


class ProcessingSuggestion(BaseModel):
    priority: str
    action: str
    rationale: str
    estimated_impact: Optional[str] = None
    related_edge_cases: Optional[List[EdgeCaseType]] = None


class ExplainableScore(BaseModel):
    metric_name: str
    value: float
    threshold: Optional[float] = None
    explanation: str
    supporting_evidence: List[Dict[str, Any]]
    formula_used: Optional[str] = None


class DiagnosisRecordBase(BaseModel):
    queue_name: str
    status: DiagnosisStatus = DiagnosisStatus.ENTRY
    manual_review_notes: Optional[str] = None
    manual_reviewer: Optional[str] = None


class DiagnosisRecordCreate(DiagnosisRecordBase):
    pass


class DiagnosisRecordUpdate(BaseModel):
    status: Optional[DiagnosisStatus] = None
    manual_review_notes: Optional[str] = None
    manual_reviewer: Optional[str] = None
    manual_correction_applied: Optional[bool] = None


class DiagnosisRecordResponse(DiagnosisRecordBase):
    id: int
    primary_cause: Optional[BacklogCause] = None
    alert_level: Optional[AlertLevel] = None
    overall_score: Optional[float] = None
    score_explanation: Optional[str] = None
    backlog_attribution: Optional[BacklogAttribution] = None
    processing_suggestions: Optional[List[ProcessingSuggestion]] = None
    manual_reviewed_at: Optional[datetime] = None
    manual_correction_applied: bool = False
    created_at: datetime
    updated_at: datetime
    exported_at: Optional[datetime] = None
    metrics: List[QueueMetricsResponse] = []
    consumer_logs: List[ConsumerLogResponse] = []
    edge_cases: List[EdgeCaseDetectionResponse] = []

    class Config:
        from_attributes = True


class DiagnosisSummary(BaseModel):
    id: int
    queue_name: str
    status: DiagnosisStatus
    primary_cause: Optional[BacklogCause] = None
    alert_level: Optional[AlertLevel] = None
    overall_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    edge_case_count: int = 0
    latest_backlog: Optional[int] = None


class DiagnosisWithExplanation(DiagnosisRecordResponse):
    score_breakdown: List[ExplainableScore] = []
    human_readable_summary: str


class ExportRequest(BaseModel):
    diagnosis_id: int
    format: str = Field(default="excel", pattern="^(json|excel)$")
    include_raw_data: bool = False


class BatchDiagnosisRequest(BaseModel):
    queue_name: str
    start_time: datetime
    end_time: datetime
    metrics: List[QueueMetricsCreate]
    consumer_logs: Optional[List[ConsumerLogCreate]] = None
