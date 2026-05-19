from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEED_MANUAL_REVIEW = "need_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"


class ReportFormat(str, Enum):
    JMETER = "jmeter"
    LOCUST = "locust"
    K6 = "k6"
    GENERIC = "generic"


class ConclusionType(str, Enum):
    PASS = "pass"
    DEGRADED = "degraded"
    NEED_REVIEW = "need_review"


class ScenarioBase(BaseModel):
    scenario_name: str
    throughput: float
    p95: float
    error_rate: float
    concurrency: Optional[float] = None
    duration: Optional[float] = None


class ReportImportRequest(BaseModel):
    report_id: str
    report_name: str
    source_format: ReportFormat
    scenarios: List[ScenarioBase]
    notes: Optional[str] = None


class ReportInfo(BaseModel):
    report_id: str
    report_name: str
    source_format: str
    imported_at: datetime
    scenario_count: int
    notes: Optional[str] = None

    class Config:
        orm_mode = True


class ScenarioInfo(BaseModel):
    scenario_name: str
    throughput: float
    p95: float
    error_rate: float
    concurrency: Optional[float] = None
    duration: Optional[float] = None

    class Config:
        orm_mode = True


class ComparisonThreshold(BaseModel):
    throughput_threshold_pct: float = Field(default=10.0, description="吞吐量退化阈值百分比")
    p95_threshold_pct: float = Field(default=20.0, description="P95延迟退化阈值百分比")
    error_rate_threshold_pct: float = Field(default=5.0, description="错误率增长阈值百分比")


class ComparisonRequest(BaseModel):
    base_report_id: str
    target_report_id: str
    thresholds: Optional[ComparisonThreshold] = None
    scenario_pattern: Optional[str] = Field(default=None, description="场景名匹配模式，支持*通配符")


class ScenarioComparison(BaseModel):
    scenario_name: str
    base_throughput: float
    target_throughput: float
    throughput_degradation_pct: float
    base_p95: float
    target_p95: float
    p95_degradation_pct: float
    base_error_rate: float
    target_error_rate: float
    error_rate_increase_pct: float
    conclusion: ConclusionType
    need_manual_review: bool


class ComparisonResponse(BaseModel):
    comparison_id: str
    base_report_id: str
    target_report_id: str
    scenarios: List[ScenarioComparison]
    overall_conclusion: ConclusionType
    degraded_count: int
    pass_count: int
    need_review_count: int


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


class ReviewRequest(BaseModel):
    comparison_id: str
    approved: bool
    notes: Optional[str] = None
