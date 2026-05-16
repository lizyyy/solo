from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any
from uuid import uuid4


class EvacuationStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    PARTIAL = "PARTIAL"
    COMPLETED = "COMPLETED"
    COMPENSATED = "COMPENSATED"


class ExecutionResult(str, Enum):
    SUCCESS = "SUCCESS"
    PENDING_REVIEW = "PENDING_REVIEW"
    BLOCKED = "BLOCKED"
    COMPENSATED = "COMPENSATED"


@dataclass
class TenantBinding:
    tenant_id: str
    tenant_name: str
    bind_time: str
    local_resources: List[str]
    traffic_percentage: float
    dependency_check_passed: Optional[bool] = None
    block_reason: Optional[str] = None


@dataclass
class LocalDependency:
    resource_type: str
    resource_name: str
    is_critical: bool
    check_status: str
    detail: Optional[str] = None


@dataclass
class EvacuationStep:
    step_id: str
    step_order: int
    target_percentage: float
    status: str
    executed_at: Optional[str] = None
    result: Optional[str] = None
    detail: Optional[str] = None


@dataclass
class ExecutionLog:
    log_id: str
    timestamp: str
    action: str
    operator: str
    original_input: Dict[str, Any]
    processing_result: Dict[str, Any]
    conclusion: str


@dataclass
class RegionEvacuationPlan:
    plan_id: str
    region_name: str
    created_at: str
    created_by: str
    status: EvacuationStatus
    tenant_bindings: List[TenantBinding]
    local_dependencies: List[LocalDependency]
    evacuation_steps: List[EvacuationStep]
    execution_logs: List[ExecutionLog]
    current_step_index: int = 0
    overall_traffic_percentage: float = 100.0
    block_reason: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


@dataclass
class ExecutionSummary:
    plan_id: str
    region_name: str
    total_tenants: int
    affected_tenants: int
    cleared_tenants: int
    blocked_tenants: int
    initial_traffic: float
    current_traffic: float
    target_traffic: float
    status: str
    created_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[int]
    block_reasons: List[str]


def generate_id() -> str:
    return str(uuid4())


def current_time() -> str:
    return datetime.utcnow().isoformat()
