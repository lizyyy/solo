from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .base import (
    BatchStatus,
    InterfaceStatus,
    RestoreRequestStatus,
    ConclusionType,
    NotificationStatus,
    NotificationChannel,
    NotificationType,
    Interface,
    CustomerGroup,
    ObservationMetric,
    RestoreRequest,
    DecommissionConclusion,
    CustomerNotification,
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


class ErrorCode(str, Enum):
    BATCH_NOT_FOUND = "BATCH_NOT_FOUND"
    METRIC_NOT_FOUND = "METRIC_NOT_FOUND"
    RESTORE_REQUEST_NOT_FOUND = "RESTORE_REQUEST_NOT_FOUND"
    CUSTOMER_GROUP_NOT_FOUND = "CUSTOMER_GROUP_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    INVALID_PHASE_CONFIG = "INVALID_PHASE_CONFIG"
    ALL_PHASES_COMPLETED = "ALL_PHASES_COMPLETED"
    BATCH_ALREADY_COMPLETED = "BATCH_ALREADY_COMPLETED"
    NOTIFICATION_ERROR = "NOTIFICATION_ERROR"


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    def model_dump(self, *args, **kwargs):
        data = super().model_dump(*args, **kwargs)
        if isinstance(data.get("timestamp"), datetime):
            data["timestamp"] = data["timestamp"].isoformat()
        return data


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


class CreateNotificationRequest(BaseModel):
    phase_id: Optional[int] = None
    customer_group_id: str
    customer_ids: Optional[List[str]] = None
    notification_type: NotificationType
    channel: NotificationChannel
    subject: str
    content: str


class UpdateNotificationStatusRequest(BaseModel):
    status: NotificationStatus
    error_message: Optional[str] = None
    updated_by: Optional[str] = None


class NotificationListResponse(BaseModel):
    notifications: List[CustomerNotification]
    total: int
    page: int
    page_size: int
