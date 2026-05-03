"""
数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


class RouteStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"
    BUDGET_EXCEEDED = "budget_exceeded"
    CIRCUIT_BROKEN = "circuit_broken"
    SENSITIVE_BLOCKED = "sensitive_blocked"
    DEGRADED = "degraded"
    RETRY = "retry"


class ModelTier(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    FALLBACK = "fallback"


@dataclass
class TestCase:
    id: str
    prompt: str
    system_prompt: Optional[str] = None
    expected_output: Optional[str] = None
    sensitive_tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    priority: int = 1
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TestCase":
        return cls(
            id=data.get("id", str(uuid4())),
            prompt=data["prompt"],
            system_prompt=data.get("system_prompt"),
            expected_output=data.get("expected_output"),
            sensitive_tags=data.get("sensitive_tags", []),
            metadata=data.get("metadata", {}),
            priority=data.get("priority", 1)
        )


@dataclass
class ModelConfig:
    provider: str
    model_name: str
    tier: ModelTier
    enabled: bool = True
    
    input_price_per_1k: float = 0.0
    output_price_per_1k: float = 0.0
    
    rpm_limit: int = 100
    tpm_limit: int = 100000
    
    daily_budget: Optional[float] = None
    monthly_budget: Optional[float] = None
    
    timeout_ms: int = 30000
    max_retries: int = 3
    
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout_ms: int = 60000
    
    degradation_models: List[str] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, name: str, data: Dict[str, Any]) -> "ModelConfig":
        provider, model = name.split(".", 1) if "." in name else (name, name)
        return cls(
            provider=data.get("provider", provider),
            model_name=data.get("model_name", model),
            tier=ModelTier(data.get("tier", "secondary")),
            enabled=data.get("enabled", True),
            input_price_per_1k=data.get("input_price_per_1k", 0.0),
            output_price_per_1k=data.get("output_price_per_1k", 0.0),
            rpm_limit=data.get("rpm_limit", 100),
            tpm_limit=data.get("tpm_limit", 100000),
            daily_budget=data.get("daily_budget"),
            monthly_budget=data.get("monthly_budget"),
            timeout_ms=data.get("timeout_ms", 30000),
            max_retries=data.get("max_retries", 3),
            circuit_breaker_threshold=data.get("circuit_breaker_threshold", 5),
            circuit_breaker_timeout_ms=data.get("circuit_breaker_timeout_ms", 60000),
            degradation_models=data.get("degradation_models", [])
        )


@dataclass
class RoutingPolicy:
    name: str
    version: str
    
    primary_selection_strategy: str = "round_robin"
    fallback_enabled: bool = True
    
    retry_enabled: bool = True
    retry_on_errors: List[str] = field(default_factory=lambda: ["timeout", "rate_limited"])
    max_retries_override: Optional[int] = None
    
    circuit_breaker_enabled: bool = True
    
    budget_tracking_enabled: bool = True
    budget_alert_threshold: float = 0.8
    
    sensitive_tag_blocking_enabled: bool = True
    blocked_sensitive_tags: List[str] = field(default_factory=list)
    
    degradation_enabled: bool = True
    auto_degrade_on_failure: bool = True
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RoutingPolicy":
        return cls(
            name=data.get("name", "default"),
            version=data.get("version", "1.0"),
            primary_selection_strategy=data.get("primary_selection_strategy", "round_robin"),
            fallback_enabled=data.get("fallback_enabled", True),
            retry_enabled=data.get("retry_enabled", True),
            retry_on_errors=data.get("retry_on_errors", ["timeout", "rate_limited"]),
            max_retries_override=data.get("max_retries_override"),
            circuit_breaker_enabled=data.get("circuit_breaker_enabled", True),
            budget_tracking_enabled=data.get("budget_tracking_enabled", True),
            budget_alert_threshold=data.get("budget_alert_threshold", 0.8),
            sensitive_tag_blocking_enabled=data.get("sensitive_tag_blocking_enabled", True),
            blocked_sensitive_tags=data.get("blocked_sensitive_tags", []),
            degradation_enabled=data.get("degradation_enabled", True),
            auto_degrade_on_failure=data.get("auto_degrade_on_failure", True)
        )


@dataclass
class RouteAttempt:
    model_name: str
    attempt_number: int
    input_tokens: int
    output_tokens: int
    latency_ms: int
    status: RouteStatus
    error_message: Optional[str] = None
    retry_reason: Optional[str] = None
    
    cost: float = field(init=False)
    
    def __post_init__(self):
        self.cost = (
            (self.input_tokens / 1000) * 0.0 + 
            (self.output_tokens / 1000) * 0.0
        )


@dataclass
class RouteResult:
    id: str
    test_case_id: str
    policy_name: str
    policy_version: str
    
    final_model: str
    final_status: RouteStatus
    final_latency_ms: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    
    attempts: List[RouteAttempt]
    
    success: bool
    degradation_triggered: bool = False
    retry_count: int = 0
    circuit_triggered: bool = False
    budget_exceeded: bool = False
    sensitive_blocked: bool = False
    hit_reason: Optional[str] = None
    
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RunSummary:
    run_id: str
    policy_name: str
    policy_version: str
    
    total_cases: int
    success_count: int
    failed_count: int
    
    total_cost: float
    avg_latency_ms: float
    
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    
    failure_rate: float
    success_rate: float
    
    degradation_rate: float
    retry_rate: float
    
    model_distribution: Dict[str, int]
    status_distribution: Dict[str, int]
    hit_reasons: Dict[str, int]
    
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class ComparisonResult:
    run_a_id: str
    run_b_id: str
    
    policy_a: str
    policy_b: str
    
    total_cases: int
    common_cases: int
    
    cost_difference: float
    cost_percentage_change: float
    
    latency_difference_ms: float
    latency_percentage_change: float
    
    success_rate_difference: float
    
    model_switch_count: int
    status_change_count: int
    
    detailed_comparisons: List[Dict[str, Any]]
