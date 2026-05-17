from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class ServiceStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class HealthCheckType(Enum):
    HTTP = "http"
    TCP = "tcp"
    COMMAND = "command"
    NONE = "none"


@dataclass
class ValidationError:
    line: Optional[int]
    field: Optional[str]
    message: str
    raw_value: Optional[Any] = None
    error_type: str = "validation_error"


@dataclass
class HealthCheckConfig:
    type: HealthCheckType
    endpoint: Optional[str] = None
    timeout: int = 10
    interval: int = 2
    max_retries: int = 30
    command: Optional[str] = None
    expected_status: int = 200


@dataclass
class ServiceConfig:
    name: str
    port: Optional[int]
    dependencies: List[str]
    start_command: str
    stop_command: Optional[str]
    health_check: HealthCheckConfig
    env: Dict[str, str] = field(default_factory=dict)
    working_dir: Optional[str] = None
    wait_before_start: int = 0
    wait_after_start: int = 0
    line_number: Optional[int] = None
    raw_data: Optional[Dict[str, Any]] = None


@dataclass
class PortCheckResult:
    port: int
    is_available: bool
    error: Optional[str] = None


@dataclass
class HealthCheckResult:
    success: bool
    status_code: Optional[int] = None
    response_time: Optional[float] = None
    error: Optional[str] = None
    output: Optional[str] = None


@dataclass
class ServiceExecutionResult:
    service_name: str
    status: ServiceStatus
    start_order: int
    port_check: Optional[PortCheckResult] = None
    health_check: Optional[HealthCheckResult] = None
    error: Optional[str] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    exit_code: Optional[int] = None


@dataclass
class OrchestrationReport:
    total_services: int
    successful: int
    failed: int
    skipped: int
    start_order: List[str]
    results: Dict[str, ServiceExecutionResult]
    validation_errors: List[ValidationError] = field(default_factory=list)
    circular_dependencies: Optional[List[List[str]]] = None
    total_time: Optional[float] = None
