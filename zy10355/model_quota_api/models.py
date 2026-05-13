from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID, uuid4


class RequestStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETURNED = "returned"


class PriorityLevel(int, Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


class BusinessParty(BaseModel):
    party_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ModelInfo(BaseModel):
    model_id: str
    name: str
    version: str
    gpu_units_per_request: int = Field(gt=0)
    avg_inference_seconds: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.now)
    is_active: bool = True
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GpuQuota(BaseModel):
    quota_id: UUID = Field(default_factory=uuid4)
    party_id: str
    model_id: str
    total_quota: int = Field(gt=0)
    used_quota: int = Field(default=0, ge=0)
    reserved_quota: int = Field(default=0, ge=0)
    effective_date: datetime
    expire_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @property
    def available_quota(self) -> int:
        return self.total_quota - self.used_quota - self.reserved_quota


class InferenceRequest(BaseModel):
    request_id: UUID = Field(default_factory=uuid4)
    idempotency_key: str
    party_id: str
    model_id: str
    requested_gpu_units: int = Field(gt=0)
    priority: PriorityLevel = PriorityLevel.NORMAL
    status: RequestStatus = RequestStatus.PENDING
    queue_position: Optional[int] = None
    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QueuePosition(BaseModel):
    position_id: UUID = Field(default_factory=uuid4)
    request_id: UUID
    party_id: str
    model_id: str
    position: int = Field(ge=0)
    priority: PriorityLevel
    requested_gpu_units: int
    enqueued_at: datetime = Field(default_factory=datetime.now)
    estimated_wait_seconds: Optional[int] = None


class ReturnRecord(BaseModel):
    return_id: UUID = Field(default_factory=uuid4)
    request_id: UUID
    party_id: str
    model_id: str
    returned_gpu_units: int = Field(gt=0)
    return_reason: str
    returned_at: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UsageRecord(BaseModel):
    record_id: UUID = Field(default_factory=uuid4)
    party_id: str
    model_id: str
    request_id: UUID
    gpu_units: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    status: RequestStatus
    created_at: datetime = Field(default_factory=datetime.now)
