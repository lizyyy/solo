from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.models.database import get_db
from app.models.models import BatchStatus, StageType
from app.schemas.schemas import (
    BatchImportRequest, ImportBatchResponse, BatchDetailResponse,
    BatchStatusUpdateRequest, RollbackPlanRequest, RollbackPlanResponse,
    RollbackReportResponse, ErrorResponse
)
from app.services.batch_service import BatchService
from app.services.rollback_service import RollbackService

router = APIRouter(prefix="/batches", tags=["batches"])


async def get_batch_service(db: AsyncSession = Depends(get_db)) -> BatchService:
    return BatchService(db)


async def get_rollback_service(db: AsyncSession = Depends(get_db)) -> RollbackService:
    return RollbackService(db)


@router.post("/", response_model=ImportBatchResponse, status_code=201,
             responses={409: {"model": ErrorResponse, "description": "Duplicate batch"}})
async def create_batch(
    request: BatchImportRequest,
    service: BatchService = Depends(get_batch_service)
):
    existing_by_no = await service.get_batch_by_no(request.batch.batch_no)
    if existing_by_no and existing_by_no.request_idempotent_key != request.batch.idempotent_key:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_BATCH_NO",
                "message": f"Batch {request.batch.batch_no} already exists"
            }
        )

    batch = await service.create_batch(request)
    return batch


@router.get("/{batch_no}", response_model=BatchDetailResponse,
            responses={404: {"model": ErrorResponse, "description": "Batch not found"}})
async def get_batch(
    batch_no: str,
    service: BatchService = Depends(get_batch_service)
):
    batch = await service.get_batch_by_no(batch_no)
    if not batch:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "BATCH_NOT_FOUND",
                "message": f"Batch {batch_no} not found"
            }
        )
    return batch


@router.patch("/{batch_id}/status", response_model=ImportBatchResponse,
              responses={404: {"model": ErrorResponse}})
async def update_batch_status(
    batch_id: int,
    request: BatchStatusUpdateRequest,
    service: BatchService = Depends(get_batch_service)
):
    batch = await service.update_batch_status(batch_id, request)
    if not batch:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "BATCH_NOT_FOUND",
                "message": f"Batch {batch_id} not found"
            }
        )
    return batch


@router.post("/{batch_id}/stages/{stage}/start", status_code=200,
             responses={404: {"model": ErrorResponse}})
async def start_stage(
    batch_id: int,
    stage: StageType,
    service: BatchService = Depends(get_batch_service)
):
    stage_record = await service.start_stage(batch_id, stage)
    if not stage_record:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "STAGE_NOT_FOUND",
                "message": f"Stage {stage} not found for batch {batch_id}"
            }
        )
    return stage_record


@router.post("/{batch_id}/stages/{stage}/complete", status_code=200,
             responses={404: {"model": ErrorResponse}})
async def complete_stage(
    batch_id: int,
    stage: StageType,
    success: bool = True,
    error_message: Optional[str] = None,
    service: BatchService = Depends(get_batch_service)
):
    stage_record = await service.complete_stage(batch_id, stage, success, error_message)
    if not stage_record:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "STAGE_NOT_FOUND",
                "message": f"Stage {stage} not found for batch {batch_id}"
            }
        )
    return stage_record


@router.get("/")
async def list_batches(
    source_system: Optional[str] = None,
    import_type: Optional[str] = None,
    status: Optional[BatchStatus] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service: BatchService = Depends(get_batch_service)
):
    batches, total = await service.query_batches(
        source_system, import_type, status, created_by,
        start_date, end_date, page, page_size
    )
    
    batch_data = []
    for batch in batches:
        batch_data.append({
            "id": batch.id,
            "batch_no": batch.batch_no,
            "source_system": batch.source_system,
            "import_type": batch.import_type,
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "failed_count": batch.failed_count,
            "status": batch.status,
            "current_stage": batch.current_stage,
            "created_by": batch.created_by,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "updated_at": batch.updated_at.isoformat() if batch.updated_at else None,
            "extra_metadata": batch.extra_metadata
        })
    
    return {
        "data": batch_data,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/{batch_id}/rollback/plan", response_model=RollbackPlanResponse,
             status_code=201, responses={404: {"model": ErrorResponse}})
async def create_rollback_plan(
    batch_id: int,
    request: RollbackPlanRequest,
    service: RollbackService = Depends(get_rollback_service)
):
    try:
        plan = await service.create_rollback_plan(batch_id, request)
        return plan
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "BATCH_NOT_FOUND",
                "message": str(e)
            }
        )


@router.post("/rollback/{plan_id}/execute", response_model=RollbackPlanResponse,
             responses={404: {"model": ErrorResponse}})
async def execute_rollback(
    plan_id: int,
    service: RollbackService = Depends(get_rollback_service)
):
    try:
        plan = await service.execute_rollback(plan_id)
        return plan
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "PLAN_NOT_FOUND",
                "message": str(e)
            }
        )


@router.get("/{batch_id}/rollback/report", response_model=RollbackReportResponse,
            responses={404: {"model": ErrorResponse}})
async def get_rollback_report(
    batch_id: int,
    service: RollbackService = Depends(get_rollback_service)
):
    plan = await service.get_plan_by_batch_id(batch_id)
    if not plan:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "ROLLBACK_PLAN_NOT_FOUND",
                "message": f"Rollback plan not found for batch {batch_id}"
            }
        )
    if not plan.report:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "REPORT_NOT_GENERATED",
                "message": "Rollback report not generated yet"
            }
        )
    return plan.report
