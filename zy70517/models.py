from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
import uuid


class ReleaseStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    BLOCKED = "blocked"
    EXEMPTED = "exempted"
    FAILED = "failed"
    COMPLETED = "completed"


class DecisionType(Enum):
    ALLOW = "allow"
    BLOCK = "block"
    REQUIRE_APPROVAL = "require_approval"


@dataclass
class SLOBudget:
    service_name: str
    slo_name: str
    slo_target: float
    total_budget: float
    remaining_budget: float
    consumed_budget: float = 0.0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ReleaseBatch:
    id: str
    service_name: str
    batch_name: str
    slo_name: str
    budget_consumption: float
    status: ReleaseStatus
    requester: str
    decision_type: DecisionType
    decision_summary: str
    exemption_reason: Optional[str] = None
    approver: Optional[str] = None
    approved_at: Optional[str] = None
    metrics_snapshot: Dict[str, Any] = field(default_factory=dict)
    raw_input: Dict[str, Any] = field(default_factory=dict)
    processing_evidence: Dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    is_manual_correction: bool = False
    correction_note: Optional[str] = None


@dataclass
class ServiceSLO:
    service_name: str
    slo_name: str
    slo_target: float
    description: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    is_active: bool = True
