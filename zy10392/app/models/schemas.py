from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .base import (
    BatchStatus,
    InterfaceStatus,
    RestoreRequestStatus,
    ConclusionType,
    Interface,
    CustomerGroup,
    ObservationMetric,
    RestoreRequest,
    DecommissionConclusion,
    BatchPhase,
    ShutdownBatch,
)


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: Optional[str] = None


class CreateBatchRequest(BaseModel):
    name: str
    description: Optional[str] = None
    phases: List[BatchPhase]
    metrics: Optional[List[ObservationMetric]] = None
    scheduled_at: Optional[datetime] = None
    created_by: str


class UpdateBatchRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phases: Optional[List[BatchPhase]] = None
    metrics: Optional[List[ObservationMetric]] = None
    scheduled_at: Optional[datetime] = None


class ValidateBatchRequest(BaseModel):
    validated_by: str


class AdvancePhaseRequest(BaseModel):
    advanced_by: str


class AddMetricRequest(BaseModel):
    name: str
    description: Optional[str] = None
    threshold: float
    unit: str = "count"


class UpdateMetricRequest(BaseModel):
    current_value: float
    measured_at: Optional[datetime] = None


class CreateRestoreRequest(BaseModel):
    interface_ids: List[str]
    customer_group_ids: Optional[List[str]] = None
    reason: str
    requester: str


class ApproveRestoreRequest(BaseModel):
    approver: str


class RejectRestoreRequest(BaseModel):
    approver: str
    reason: str


class CreateConclusionRequest(BaseModel):
    conclusion_type: ConclusionType
    summary: str
    archived_by: str
    notes: Optional[str] = None


class BatchListResponse(BaseModel):
    batches: List[ShutdownBatch]
    total: int
    page: int
    page_size: int


class BatchHistoryItem(BaseModel):
    timestamp: datetime
    action: str
    status_from: Optional[BatchStatus] = None
    status_to: Optional[BatchStatus] = None
    performed_by: str
    details: Optional[Dict[str, Any]] = None


class BatchHistoryResponse(BaseModel):
    batch_id: str
    history: List[BatchHistoryItem]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class DuplicateSubmissionError(ErrorResponse):
    error_code: str = "DUPLICATE_SUBMISSION"
    message: str = "Duplicate submission detected"


class InvalidStateTransitionError(ErrorResponse):
    error_code: str = "INVALID_STATE_TRANSITION"
    message: str = "Invalid state transition"


class ValidationError(ErrorResponse):
    error_code: str = "VALIDATION_ERROR"
    message: str = "Validation failed"


class ResourceNotFoundError(ErrorResponse):
    error_code: str = "RESOURCE_NOT_FOUND"
    message: str = "Resource not found"
