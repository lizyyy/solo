from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class ConflictType(Enum):
    PORT = "port"
    SERVICE_NAME = "service_name"
    ENV_VAR = "env_var"


class ConflictSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class PortMapping:
    host_port: int
    container_port: int
    protocol: str = "tcp"
    host_ip: str = "0.0.0.0"


@dataclass
class ServiceInfo:
    name: str
    compose_file: str
    ports: List[PortMapping] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    raw_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConflictSource:
    service_name: str
    compose_file: str
    details: str


@dataclass
class Conflict:
    conflict_type: ConflictType
    severity: ConflictSeverity
    message: str
    sources: List[ConflictSource] = field(default_factory=list)
    suggestion: str = ""
    priority: int = 0


@dataclass
class CheckResult:
    services: List[ServiceInfo] = field(default_factory=list)
    conflicts: List[Conflict] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def has_conflicts(self) -> bool:
        return len(self.conflicts) > 0

    def get_exit_code(self) -> int:
        if self.errors:
            return 2
        if any(c.severity == ConflictSeverity.CRITICAL for c in self.conflicts):
            return 1
        if any(c.severity in [ConflictSeverity.HIGH, ConflictSeverity.MEDIUM] for c in self.conflicts):
            return 1
        return 0
