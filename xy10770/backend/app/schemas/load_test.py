from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict, Any

class StatusEnum:
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    INTERCEPTED = "intercepted"
    RETRYABLE = "retryable"
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"

class ConcurrencyStepBase(BaseModel):
    step_order: int
    concurrent_users: int
    duration_seconds: int
    ramp_up_seconds: int
    target_qps: Optional[int] = None
    actual_qps: Optional[float] = None

class ConcurrencyStepCreate(ConcurrencyStepBase):
    pass

class ConcurrencyStep(ConcurrencyStepBase):
    id: int
    plan_id: int
    
    class Config:
        from_attributes = True

class ResponsePercentileBase(BaseModel):
    p50: float
    p75: float
    p90: float
    p95: float
    p99: float
    p999: float
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    total_requests: int
    success_requests: int
    failed_requests: int

class ResponsePercentileCreate(ResponsePercentileBase):
    pass

class ResponsePercentile(ResponsePercentileBase):
    id: int
    plan_id: int
    
    class Config:
        from_attributes = True

class ErrorDistributionBase(BaseModel):
    error_type: str
    error_code: str
    error_message: str
    count: int
    percentage: float
    is_anomaly: bool = False
    anomaly_reason: Optional[str] = None

class ErrorDistributionCreate(ErrorDistributionBase):
    pass

class ErrorDistribution(ErrorDistributionBase):
    id: int
    plan_id: int
    
    class Config:
        from_attributes = True

class BottleneckBase(BaseModel):
    bottleneck_type: str
    description: str
    severity: str
    is_confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    suggestion: Optional[str] = None

class BottleneckCreate(BottleneckBase):
    pass

class Bottleneck(BottleneckBase):
    id: int
    plan_id: int
    
    class Config:
        from_attributes = True

class TestReportBase(BaseModel):
    report_type: str
    content: str
    generated_by: str

class TestReportCreate(TestReportBase):
    pass

class TestReport(TestReportBase):
    id: int
    plan_id: int
    generated_at: datetime
    
    class Config:
        from_attributes = True

class LoadTestPlanBase(BaseModel):
    name: str
    version: str
    api_name: str
    api_url: str
    method: str
    headers: Optional[str] = None
    body: Optional[str] = None
    created_by: str
    remark: Optional[str] = None
    request_idempotent_key: Optional[str] = None

class LoadTestPlanCreate(LoadTestPlanBase):
    concurrency_steps: List[ConcurrencyStepCreate] = []
    response_percentiles: Optional[ResponsePercentileCreate] = None
    error_distributions: List[ErrorDistributionCreate] = []
    bottlenecks: List[BottleneckCreate] = []

class LoadTestPlanUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    api_name: Optional[str] = None
    api_url: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[str] = None
    body: Optional[str] = None
    remark: Optional[str] = None

class LoadTestPlan(LoadTestPlanBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    concurrency_steps: List[ConcurrencyStep] = []
    response_percentiles: List[ResponsePercentile] = []
    error_distributions: List[ErrorDistribution] = []
    bottlenecks: List[Bottleneck] = []
    reports: List[TestReport] = []
    
    class Config:
        from_attributes = True

class ApiResponse(BaseModel):
    code: int
    status: str
    message: str
    data: Optional[Any] = None

class LoadTestPlanListResponse(BaseModel):
    total: int
    items: List[LoadTestPlan]