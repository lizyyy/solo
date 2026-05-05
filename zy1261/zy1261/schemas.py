from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class RouteConfigCreate(BaseModel):
    key: Optional[str] = None
    path: str
    method: str = "GET"
    service_name: Optional[str] = None
    endpoint_name: Optional[str] = None


class ProtectionPolicyCreate(BaseModel):
    key: Optional[str] = None
    route_key: str
    
    rate_limit_enabled: bool = True
    rate_limit_type: str = "fixed_window"
    rate_limit_threshold: int = 100
    rate_limit_window_seconds: int = 60
    rate_limit_burst: int = 10
    
    circuit_breaker_enabled: bool = True
    cb_failure_threshold: float = 0.5
    cb_min_requests: int = 10
    cb_half_open_max_requests: int = 3
    cb_open_duration_seconds: int = 30
    cb_sliding_window_size: int = 100
    
    degradation_enabled: bool = True
    degradation_fallback_type: str = "default_response"
    degradation_fallback_value: Optional[Dict[str, Any]] = None


class PolicyVersionCreate(BaseModel):
    version: Optional[str] = None
    description: str = ""
    routes_config: Optional[Dict[str, Any]] = None
    protection_config: Optional[Dict[str, Any]] = None
    auto_apply: bool = False


class CanaryReleaseStart(BaseModel):
    version_id: int
    canary_percentage: int = 10
    keep_old_active: bool = True


class CanaryPercentageUpdate(BaseModel):
    version_id: int
    canary_percentage: int


class PolicyRollback(BaseModel):
    from_version_id: int
    to_version_id: int


class RequestEvaluate(BaseModel):
    path: str
    method: str = "GET"
    request_id: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    is_dry_run: bool = False
    request_identifier: Optional[str] = None


class RequestResult(BaseModel):
    request_id: str
    is_success: bool
    response_status: Optional[int] = None
    response_time_ms: Optional[float] = None


class HealthReport(BaseModel):
    dependency_key: str
    is_healthy: bool
    error_rate: float = 0.0
    latency_p99_ms: float = 0.0
    success_count: int = 0
    failure_count: int = 0
    total_requests: Optional[int] = None
    service_name: Optional[str] = None
    endpoint: Optional[str] = None


class CircuitBreakerAction(BaseModel):
    route_key: str
    reason: str = "Manual action"


class ReportExportRequest(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    include_samples: bool = False
