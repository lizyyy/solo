from typing import Optional
from fastapi import APIRouter, Header, HTTPException, status

from app.models.base import BatchStatus
from app.models.schemas import (
    ApiResponse,
    CreateBatchRequest,
    ValidateBatchRequest,
    AdvancePhaseRequest,
    UpdateMetricRequest,
    CreateRestoreRequest,
    ApproveRestoreRequest,
    CreateConclusionRequest,
    BatchListResponse,
    BatchHistoryResponse,
    ErrorResponse,
)
from app.services.batch_service import BatchService


router = APIRouter(prefix="/api/v1/batches", tags=["batches"])
batch_service = BatchService()


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(
    request: CreateBatchRequest,
    x_idempotency_key: Optional[str] = Header(None),
):
    try:
        batch = batch_service.create_batch(request, x_idempotency_key)
        return ApiResponse(success=True, data=batch, message="Batch created successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
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
            detail=ErrorResponse(error_code="RESOURCE_NOT_FOUND", message="Batch not found").dict(),
        )
    return ApiResponse(success=True, data=batch)


@router.post("/{batch_id}/validate", response_model=ApiResponse)
async def validate_batch(batch_id: str, request: ValidateBatchRequest):
    try:
        batch = batch_service.validate_batch(batch_id, request.validated_by)
        return ApiResponse(success=True, data=batch, message="Batch validated successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.post("/{batch_id}/start", response_model=ApiResponse)
async def start_batch(batch_id: str, request: AdvancePhaseRequest):
    try:
        batch = batch_service.start_batch(batch_id, request.advanced_by)
        return ApiResponse(success=True, data=batch, message="Batch phase started successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.post("/{batch_id}/observe", response_model=ApiResponse)
async def start_observation(batch_id: str, request: AdvancePhaseRequest):
    try:
        batch = batch_service.start_observation(batch_id, request.advanced_by)
        return ApiResponse(success=True, data=batch, message="Observation started successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.post("/{batch_id}/restore-requests", response_model=ApiResponse)
async def create_restore_request(batch_id: str, request: CreateRestoreRequest):
    try:
        restore_request = batch_service.create_restore_request(batch_id, request)
        return ApiResponse(success=True, data=restore_request, message="Restore request created successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.post("/{batch_id}/complete", response_model=ApiResponse)
async def complete_batch(batch_id: str, request: CreateConclusionRequest):
    try:
        batch = batch_service.complete_batch(batch_id, request)
        return ApiResponse(success=True, data=batch, message="Batch completed successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.post("/{batch_id}/cancel", response_model=ApiResponse)
async def cancel_batch(batch_id: str, cancelled_by: str):
    try:
        batch = batch_service.cancel_batch(batch_id, cancelled_by)
        return ApiResponse(success=True, data=batch, message="Batch cancelled successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(message=str(e)).dict(),
        )


@router.get("/{batch_id}/history", response_model=BatchHistoryResponse)
async def get_batch_history(batch_id: str):
    try:
        history = batch_service.get_history(batch_id)
        return BatchHistoryResponse(batch_id=batch_id, history=history)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(message=str(e)).dict(),
        )
