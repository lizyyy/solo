from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base
import enum


class CircuitBreakerState(str, enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class RequestDecision(str, enum.Enum):
    ALLOW = "allow"
    RATE_LIMITED = "rate_limited"
    CIRCUIT_BREAKER_OPEN = "circuit_breaker_open"
    CIRCUIT_BREAKER_HALF_OPEN = "circuit_breaker_half_open"
    DEGRADED = "degraded"


class PolicyStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CANARY = "canary"
    ROLLED_BACK = "rolled_back"


class PolicyVersion(Base):
    __tablename__ = "policy_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    status = Column(String, default=PolicyStatus.DRAFT)
    canary_percentage = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    routes_config = Column(JSON, nullable=True)
    protection_config = Column(JSON, nullable=True)


class RouteConfig(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    route_key = Column(String, unique=True, index=True)
    path = Column(String, nullable=False)
    method = Column(String, default="GET")
    service_name = Column(String, nullable=True)
    endpoint_name = Column(String, nullable=True)
    policy_version_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ProtectionPolicy(Base):
    __tablename__ = "protection_policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_key = Column(String, unique=True, index=True)
    route_key = Column(String, index=True)
    policy_version_id = Column(Integer, nullable=True)
    
    rate_limit_enabled = Column(Boolean, default=True)
    rate_limit_type = Column(String, default="fixed_window")
    rate_limit_threshold = Column(Integer, default=100)
    rate_limit_window_seconds = Column(Integer, default=60)
    rate_limit_burst = Column(Integer, default=10)
    
    circuit_breaker_enabled = Column(Boolean, default=True)
    cb_failure_threshold = Column(Float, default=0.5)
    cb_min_requests = Column(Integer, default=10)
    cb_half_open_max_requests = Column(Integer, default=3)
    cb_open_duration_seconds = Column(Integer, default=30)
    cb_sliding_window_size = Column(Integer, default=100)
    
    degradation_enabled = Column(Boolean, default=True)
    degradation_fallback_type = Column(String, default="default_response")
    degradation_fallback_value = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class DependencyHealth(Base):
    __tablename__ = "dependency_health"

    id = Column(Integer, primary_key=True, index=True)
    dependency_key = Column(String, unique=True, index=True)
    service_name = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    
    is_healthy = Column(Boolean, default=True)
    error_rate = Column(Float, default=0.0)
    latency_p99_ms = Column(Float, default=0.0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    total_requests = Column(Integer, default=0)
    
    last_check_at = Column(DateTime(timezone=True), server_default=func.now())
    reported_at = Column(DateTime(timezone=True), server_default=func.now())


class CircuitBreakerRecord(Base):
    __tablename__ = "circuit_breaker_records"

    id = Column(Integer, primary_key=True, index=True)
    route_key = Column(String, index=True)
    policy_version_id = Column(Integer, nullable=True)
    
    state = Column(String, default=CircuitBreakerState.CLOSED)
    previous_state = Column(String, nullable=True)
    
    failure_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    failure_rate = Column(Float, default=0.0)
    
    open_at = Column(DateTime(timezone=True), nullable=True)
    half_open_attempts = Column(Integer, default=0)
    
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RequestLog(Base):
    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True)
    
    route_key = Column(String, index=True)
    path = Column(String, nullable=False)
    method = Column(String, default="GET")
    
    policy_version_id = Column(Integer, nullable=True)
    policy_version = Column(String, nullable=True)
    
    decision = Column(String, nullable=False)
    decision_reason = Column(Text, nullable=True)
    
    threshold_value = Column(Float, nullable=True)
    actual_value = Column(Float, nullable=True)
    
    is_dry_run = Column(Boolean, default=False)
    dry_run_result = Column(Text, nullable=True)
    
    circuit_breaker_state = Column(String, nullable=True)
    circuit_breaker_state_before = Column(String, nullable=True)
    
    headers = Column(JSON, nullable=True)
    query_params = Column(JSON, nullable=True)
    body = Column(Text, nullable=True)
    
    response_status = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RequestSample(Base):
    __tablename__ = "request_samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_key = Column(String, unique=True, index=True)
    route_key = Column(String, index=True)
    
    path = Column(String, nullable=False)
    method = Column(String, default="GET")
    headers = Column(JSON, nullable=True)
    query_params = Column(JSON, nullable=True)
    body = Column(Text, nullable=True)
    
    expected_decision = Column(String, nullable=True)
    expected_reason = Column(Text, nullable=True)
    
    is_bad_sample = Column(Boolean, default=False)
    bad_sample_hint = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
