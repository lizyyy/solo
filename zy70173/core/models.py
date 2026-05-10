from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field
from uuid import uuid4


class RequestStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    DEGRADED = "degraded"
    FAILED = "failed"


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class RejectReason(str, Enum):
    QUEUE_FULL = "queue_full"
    CONCURRENCY_LIMIT = "concurrency_limit"
    CIRCUIT_OPEN = "circuit_open"
    RATE_LIMIT = "rate_limit"
    TENANT_DISABLED = "tenant_disabled"


class TenantConfig(BaseModel):
    tenant_id: str
    name: str
    max_queue_size: int = 100
    max_concurrency: int = 5
    request_timeout: float = 30.0
    rate_limit_per_minute: int = 60
    circuit_breaker_error_threshold: float = 0.5
    circuit_breaker_timeout: float = 60.0
    half_open_max_requests: int = 3
    priority: int = 1
    enabled: bool = True
    max_retries: int = 0


class RequestRecord(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    tenant_id: str
    status: RequestStatus
    reject_reason: Optional[RejectReason] = None
    current_block_point: Optional[str] = None
    previous_processing_record: Optional[str] = None
    queued_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    degraded: bool = False
    degraded_reason: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    response: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TenantMetrics(BaseModel):
    tenant_id: str
    timestamp: datetime
    window_seconds: int
    total_requests: int = 0
    successful_requests: int = 0
    rejected_requests: int = 0
    failed_requests: int = 0
    timeout_requests: int = 0
    degraded_requests: int = 0
    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    queue_depth: int = 0
    active_requests: int = 0
    error_rate: float = 0.0
    rejection_rate: float = 0.0


class CircuitBreakerState(BaseModel):
    tenant_id: str
    state: CircuitState
    last_state_change: datetime
    open_timeout: datetime
    error_count: int = 0
    success_count: int = 0
    request_count: int = 0
    half_open_success_count: int = 0
    half_open_total_count: int = 0


class SLOConfig(BaseModel):
    name: str
    tenant_id: str
    target_success_rate: float = 0.99
    target_latency_p95_ms: float = 1000.0
    window_days: int = 30


class SLOReport(BaseModel):
    slo_name: str
    tenant_id: str
    period_start: datetime
    period_end: datetime
    total_requests: int
    successful_requests: int
    success_rate: float
    target_success_rate: float
    success_rate_achieved: bool
    p95_latency_ms: float
    target_p95_latency_ms: float
    latency_achieved: bool
    error_budget_remaining: float
    degraded_requests: int
    rejected_requests: int
    breakdown_by_reason: Dict[str, int]


class BackgroundTaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRY = "retry"


class BackgroundTaskRecord(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid4()))
    task_type: str
    tenant_id: Optional[str] = None
    status: BackgroundTaskStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    result: Dict[str, Any] = Field(default_factory=dict)
