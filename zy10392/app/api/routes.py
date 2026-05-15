from typing import Optional
from fastapi import APIRouter, Header, HTTPException, status

from app.models.base import BatchStatus, NotificationStatus, NotificationType
from app.models.schemas import (
    ApiResponse,
    CreateBatchRequest,
    ValidateBatchRequest,
    AdvancePhaseRequest,
    UpdateMetricRequest,
    CreateRestoreRequest,
    ApproveRestoreRequest,
    CreateConclusionRequest,
    CreateNotificationRequest,
    UpdateNotificationStatusRequest,
    BatchListResponse,
    BatchHistoryResponse,
    NotificationListResponse,
    ErrorResponse,
    ErrorCode,
)
from app.services.batch_service import BatchService


router = APIRouter(prefix="/api/v1/batches", tags=["batches"])
batch_service = BatchService()


def _get_error_code_from_message(message: str) -> str:
    if "not found" in message.lower():
        if "batch" in message.lower():
            return ErrorCode.BATCH_NOT_FOUND.value
        if "metric" in message.lower():
            return ErrorCode.METRIC_NOT_FOUND.value
        if "restore request" in message.lower():
            return ErrorCode.RESTORE_REQUEST_NOT_FOUND.value
    if "cannot" in message.lower() and "state" in message.lower():
        return ErrorCode.INVALID_STATE_TRANSITION.value
    if "phase" in message.lower():
        return ErrorCode.INVALID_PHASE_CONFIG.value
    if "all phases" in message.lower():
        return ErrorCode.ALL_PHASES_COMPLETED.value
    return ErrorCode.VALIDATION_ERROR.value


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    request: CreateBatchRequest,
    x_idempotency_key: Optional[str] = Header(None),
):
    try:
        batch = batch_service.create_batch(request, x_idempotency_key)
        return ApiResponse(success=True, data=batch, message="Batch created successfully")
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.get("", response_model=BatchListResponse)
async def list_batches(
    status: Optional[BatchStatus] = None,
    page: int = 1,
    page_size: int = 20,
):
    batches, total = batch_service.list_batches(status, page, page_size)
    return BatchListResponse(batches=batches, total=total, page=page, page_size=page_size)


@router.get("/{batch_id}", response_model=ApiResponse)
async def get_batch(batch_id: str):
    batch = batch_service.get_batch(batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.BATCH_NOT_FOUND.value,
                message="Batch not found",
            ).model_dump(),
        )
    return ApiResponse(success=True, data=batch)


@router.post("/{batch_id}/validate", response_model=ApiResponse)
async def validate_batch(batch_id: str, request: ValidateBatchRequest):
    try:
        batch = batch_service.validate_batch(batch_id, request.validated_by)
        return ApiResponse(success=True, data=batch, message="Batch validated successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/start", response_model=ApiResponse)
async def start_batch(batch_id: str, request: AdvancePhaseRequest):
    try:
        batch = batch_service.start_batch(batch_id, request.advanced_by)
        return ApiResponse(success=True, data=batch, message="Batch phase started successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/observe", response_model=ApiResponse)
async def start_observation(batch_id: str, request: AdvancePhaseRequest):
    try:
        batch = batch_service.start_observation(batch_id, request.advanced_by)
        return ApiResponse(success=True, data=batch, message="Observation started successfully")
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.put("/{batch_id}/metrics/{metric_id}", response_model=ApiResponse)
async def update_metric(
    batch_id: str,
    metric_id: str,
    request: UpdateMetricRequest,
):
    try:
        batch = batch_service.update_metric(
            batch_id,
            metric_id,
            request.current_value,
            request.measured_at,
        )
        return ApiResponse(success=True, data=batch, message="Metric updated successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/restore-requests", response_model=ApiResponse)
async def create_restore_request(batch_id: str, request: CreateRestoreRequest):
    try:
        restore_request = batch_service.create_restore_request(batch_id, request)
        return ApiResponse(success=True, data=restore_request, message="Restore request created successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/restore-requests/{restore_request_id}/approve", response_model=ApiResponse)
async def approve_restore_request(
    batch_id: str,
    restore_request_id: str,
    request: ApproveRestoreRequest,
):
    try:
        restore_request = batch_service.approve_restore_request(
            batch_id,
            restore_request_id,
            request.approver,
        )
        return ApiResponse(success=True, data=restore_request, message="Restore request approved successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/complete", response_model=ApiResponse)
async def complete_batch(batch_id: str, request: CreateConclusionRequest):
    try:
        batch = batch_service.complete_batch(batch_id, request)
        return ApiResponse(success=True, data=batch, message="Batch completed successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/cancel", response_model=ApiResponse)
async def cancel_batch(batch_id: str, cancelled_by: str):
    try:
        batch = batch_service.cancel_batch(batch_id, cancelled_by)
        return ApiResponse(success=True, data=batch, message="Batch cancelled successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.get("/{batch_id}/history", response_model=BatchHistoryResponse)
async def get_batch_history(batch_id: str):
    try:
        history = batch_service.get_history(batch_id)
        return BatchHistoryResponse(batch_id=batch_id, history=history)
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/notifications", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(batch_id: str, request: CreateNotificationRequest):
    try:
        notification = batch_service.create_notification(batch_id, request)
        return ApiResponse(success=True, data=notification, message="Notification created successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.get("/{batch_id}/notifications", response_model=NotificationListResponse)
async def list_notifications(
    batch_id: str,
    status: Optional[NotificationStatus] = None,
    notification_type: Optional[NotificationType] = None,
    page: int = 1,
    page_size: int = 20,
):
    try:
        notifications, total = batch_service.list_notifications(
            batch_id,
            status=status,
            notification_type=notification_type,
            page=page,
            page_size=page_size,
        )
        return NotificationListResponse(
            notifications=notifications,
            total=total,
            page=page,
            page_size=page_size,
        )
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.get("/{batch_id}/notifications/{notification_id}", response_model=ApiResponse)
async def get_notification(batch_id: str, notification_id: str):
    notification = batch_service.get_notification(batch_id, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOTIFICATION_ERROR.value,
                message="Notification not found",
            ).model_dump(),
        )
    return ApiResponse(success=True, data=notification)


@router.put("/{batch_id}/notifications/{notification_id}/status", response_model=ApiResponse)
async def update_notification_status(
    batch_id: str,
    notification_id: str,
    request: UpdateNotificationStatusRequest,
):
    try:
        notification = batch_service.update_notification_status(batch_id, notification_id, request)
        return ApiResponse(success=True, data=notification, message="Notification status updated successfully")
    except ValueError as e:
        error_msg = str(e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )


@router.post("/{batch_id}/phases/{phase_id}/auto-notify", response_model=ApiResponse)
async def auto_create_phase_notification(
    batch_id: str,
    phase_id: int,
    notification_type: NotificationType,
):
    try:
        notification = batch_service.auto_create_phase_notification(batch_id, phase_id, notification_type)
        return ApiResponse(success=True, data=notification, message="Auto notification created successfully")
    except ValueError as e:
        error_msg = str(e)
        status_code = status.HTTP_404_NOT_FOUND if "not found" in error_msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                error_code=_get_error_code_from_message(error_msg),
                message=error_msg,
            ).model_dump(),
        )
