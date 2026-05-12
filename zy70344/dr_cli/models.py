from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SwitchStatus(Enum):
    NOT_STARTED = "not_started"
    PRECHECKING = "prechecking"
    PRECHECK_FAILED = "precheck_failed"
    READY_TO_SWITCH = "ready_to_switch"
    SWITCHING = "switching"
    SWITCHED = "switched"
    VERIFYING = "verifying"
    VERIFY_FAILED = "verify_failed"
    COMPLETED = "completed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"


@dataclass
class Service:
    id: str
    name: str
    primary_endpoint: str
    secondary_endpoint: str
    status: str = "primary"
    health_check_url: Optional[str] = None
    database: Optional[str] = None


@dataclass
class PrecheckRule:
    id: str
    name: str
    service_id: Optional[str] = None
    description: str = ""
    is_blocking: bool = True


@dataclass
class VerifyRule:
    id: str
    name: str
    service_id: str
    description: str = ""
    is_blocking: bool = True


@dataclass
class StepExecution:
    id: str
    name: str
    step_type: str
    service_id: Optional[str]
    rule_id: Optional[str]
    status: StepStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: float = 0.0
    error_message: Optional[str] = None
    skip_reason: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SyncStatus:
    service_id: str
    lag_seconds: float
    is_synced: bool
    last_sync_time: Optional[datetime] = None


@dataclass
class ExecutionState:
    run_id: str
    plan_name: str
    started_at: datetime
    current_status: SwitchStatus
    steps: List[StepExecution] = field(default_factory=list)
    services: List[Service] = field(default_factory=list)
    sync_statuses: List[SyncStatus] = field(default_factory=list)
    human_interventions: List[str] = field(default_factory=list)
    completed_at: Optional[datetime] = None

    @property
    def total_duration(self) -> float:
        if not self.completed_at:
            return (datetime.now() - self.started_at).total_seconds()
        return (self.completed_at - self.started_at).total_seconds()

    @property
    def passed_steps(self) -> int:
        return sum(1 for s in self.steps if s.status == StepStatus.PASSED)

    @property
    def failed_steps(self) -> int:
        return sum(1 for s in self.steps if s.status == StepStatus.FAILED)

    @property
    def skipped_steps(self) -> int:
        return sum(1 for s in self.steps if s.status == StepStatus.SKIPPED)


@dataclass
class DrPlan:
    name: str
    version: str
    description: str
    services: List[Service]
    precheck_rules: List[PrecheckRule]
    verify_rules: List[VerifyRule]
    require_sync_before_rollback: bool = True
