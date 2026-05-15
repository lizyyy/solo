from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class BatchStatus(str, Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    IN_PROGRESS = "in_progress"
    OBSERVING = "observing"
    PARTIAL_RESTORED = "partial_restored"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class InterfaceStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    RESTORED = "restored"
    DECOMMISSIONED = "decommissioned"


class RestoreRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"


class ConclusionType(str, Enum):
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    ROLLBACK = "rollback"


class Interface(BaseModel):
    id: str
    name: str
    method: str
    path: str
    description: Optional[str] = None
    owner: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class CustomerGroup(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    customer_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)


class ObservationMetric(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    threshold: float
    current_value: Optional[float] = None
    unit: str = "count"
    is_alert: bool = False
    measured_at: Optional[datetime] = None


class RestoreRequest(BaseModel):
    id: str
    batch_id: str
    interface_ids: List[str]
    customer_group_ids: Optional[List[str]] = None
    reason: str
    requester: str
    status: RestoreRequestStatus = RestoreRequestStatus.PENDING
    approver: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    executed_at: Optional[datetime] = None


class DecommissionConclusion(BaseModel):
    id: str
    batch_id: str
    conclusion_type: ConclusionType
    summary: str
    final_metrics: List[ObservationMetric] = Field(default_factory=list)
    affected_interfaces: List[str] = Field(default_factory=list)
    affected_customers: int = 0
    archived_by: str
    archived_at: datetime = Field(default_factory=datetime.now)
    notes: Optional[str] = None


class BatchPhase(BaseModel):
    phase_number: int
    interface_ids: List[str]
    customer_group_ids: List[str]
    status: InterfaceStatus = InterfaceStatus.ACTIVE
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ShutdownBatch(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: BatchStatus = BatchStatus.DRAFT
    phases: List[BatchPhase] = Field(default_factory=list)
    metrics: List[ObservationMetric] = Field(default_factory=list)
    restore_requests: List[RestoreRequest] = Field(default_factory=list)
    conclusion: Optional[DecommissionConclusion] = None
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    scheduled_at: Optional[datetime] = None
    current_phase: int = 0

    @validator('phases')
    def validate_phases(cls, v):
        phase_numbers = [p.phase_number for p in v]
        if len(phase_numbers) != len(set(phase_numbers)):
            raise ValueError('Phase numbers must be unique')
        return v
