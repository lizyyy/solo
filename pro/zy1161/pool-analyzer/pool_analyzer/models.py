from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class PoolConfig:
    service_name: str
    max_pool_size: int
    min_pool_size: int = 0
    connection_timeout: float = 30.0
    idle_timeout: float = 300.0
    max_lifetime: float = 1800.0
    retry_attempts: int = 3
    retry_delay: float = 1.0
    statement_timeout: float = 60.0


@dataclass
class Service:
    name: str
    service_type: str
    pool_config_name: str
    instances: int = 1
    priority: int = 5
    tenant_id: Optional[str] = None
    description: str = ""


@dataclass
class TrafficProfile:
    service_name: str
    peak_qps: float
    avg_db_calls_per_request: float
    peak_db_calls_per_request: float
    avg_connection_hold_time_ms: float
    peak_connection_hold_time_ms: float
    time_window_minutes: int = 5


@dataclass
class DatabaseLimits:
    max_connections: int
    reserved_connections: int = 10
    superuser_reserved_connections: int = 3
    max_connections_per_tenant: Optional[int] = None
    max_wal_size: str = "1GB"
    shared_buffers: str = "128MB"


@dataclass
class ConnectionBudget:
    service_name: str
    pool_config: PoolConfig
    instances: int
    max_possible_connections: int
    min_possible_connections: int
    expected_peak_connections: float
    utilization_ratio: float


@dataclass
class RiskAssessment:
    risk_type: str
    risk_level: RiskLevel
    service_name: Optional[str] = None
    tenant_id: Optional[str] = None
    description: str = ""
    details: Dict = field(default_factory=dict)
    suggested_mitigation: str = ""


@dataclass
class SimulationResult:
    timestamp: str
    total_connections: int
    connections_by_service: Dict[str, int]
    connections_by_tenant: Dict[str, int]
    wait_queue_size: int
    timeout_events: int
    retry_events: int
    available_connections: int


@dataclass
class AnalysisReport:
    report_id: str
    generated_at: str
    database_limits: DatabaseLimits
    services: List[Service]
    pool_configs: Dict[str, PoolConfig]
    traffic_profiles: Dict[str, TrafficProfile]
    connection_budgets: List[ConnectionBudget]
    total_max_possible: int
    total_min_possible: int
    total_expected_peak: float
    remaining_headroom: int
    utilization_percentage: float
    risks: List[RiskAssessment]
    simulation_results: List[SimulationResult]
    summary: str
