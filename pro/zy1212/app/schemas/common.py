from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class PriorityEnum(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class HTTPMethodEnum(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    OPTIONS = "OPTIONS"
    HEAD = "HEAD"


class TestTypeEnum(str, Enum):
    stress = "stress"
    load = "load"
    soak = "soak"
    spike = "spike"
    baseline = "baseline"


class EnvironmentEnum(str, Enum):
    development = "development"
    staging = "staging"
    production = "production"
    performance = "performance"


class DistributionPatternEnum(str, Enum):
    uniform = "uniform"
    normal = "normal"
    poisson = "poisson"
    burst = "burst"


class OptimizationActionTypeEnum(str, Enum):
    code_optimization = "code_optimization"
    database_optimization = "database_optimization"
    cache_strategy = "cache_strategy"
    infrastructure = "infrastructure"
    configuration = "configuration"
    network = "network"
    other = "other"


class OptimizationStatusEnum(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    implemented = "implemented"
    verified = "verified"
    rejected = "rejected"


class SLOStatusEnum(str, Enum):
    passed = "passed"
    failed = "failed"
    warning = "warning"


class SLOCriteria(BaseModel):
    max_response_time_ms: Optional[int] = Field(None, ge=0)
    max_p95_response_time_ms: Optional[int] = Field(None, ge=0)
    max_p99_response_time_ms: Optional[int] = Field(None, ge=0)
    max_error_rate: Optional[float] = Field(None, ge=0, le=1)
    min_qps: Optional[float] = Field(None, ge=0)
    max_cpu_utilization: Optional[float] = Field(None, ge=0, le=100)
    max_memory_utilization: Optional[float] = Field(None, ge=0, le=100)


class MetricComparison(BaseModel):
    metric_name: str
    baseline_value: float
    current_value: float
    change_percent: float
    is_improvement: bool


class BaselineComparisonResult(BaseModel):
    baseline_batch_id: int
    current_batch_id: int
    comparisons: List[MetricComparison]
    overall_status: str
    summary: str


class SLOEvaluationResult(BaseModel):
    criteria: SLOCriteria
    passed: bool
    status: SLOStatusEnum
    violations: List[str]
    warnings: List[str]
    summary: str


class BottleneckAnalysis(BaseModel):
    bottleneck_type: str
    severity: str
    description: str
    affected_metrics: List[str]
    recommended_actions: List[str]


class NextLoadTestPlan(BaseModel):
    suggested_changes: List[str]
    expected_improvements: List[str]
    recommended_test_type: str
    estimated_duration_minutes: int
    notes: str


class ReportExport(BaseModel):
    format: str
    content: str
    generated_at: datetime
