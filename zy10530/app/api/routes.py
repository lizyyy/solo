from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import (
    TaskBatchCreate, TaskBatchUpdate, TaskBatchResponse,
    FailureReasonCreate, FailureReasonResponse,
    RerunBudgetCreate, RerunBudgetResponse,
    RerunRequest, RerunResponse,
    BudgetStatusUpdate, ManualCorrection,
    BatchDetailResponse, ExportFilter,
    RerunSummaryResponse
)
from app.services.budget_service import BudgetService

router = APIRouter(prefix="/api/v1/rerun-budget", tags=["rerun-budget"])


@router.post("/batches", response_model=TaskBatchResponse)
def create_batch(
    batch_data: TaskBatchCreate,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    return service.create_batch(batch_data)


@router.get("/batches/{batch_id}", response_model=BatchDetailResponse)
def get_batch_details(
    batch_id: str,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    details = service.get_batch_details(batch_id)
    if not details:
        raise HTTPException(status_code=404, detail="Batch not found")
    return details


@router.get("/batches", response_model=List[TaskBatchResponse])
def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    return service.list_batches(skip=skip, limit=limit, status=status)


@router.patch("/batches/{batch_id}", response_model=TaskBatchResponse)
def update_batch(
    batch_id: str,
    update_data: TaskBatchUpdate,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    batch = service.update_batch(batch_id, update_data)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/batches/{batch_id}/failure-reasons", response_model=FailureReasonResponse)
def add_failure_reason(
    batch_id: str,
    reason_data: FailureReasonCreate,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    try:
        return service.add_failure_reason(batch_id, reason_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/batches/{batch_id}/budgets", response_model=RerunBudgetResponse)
def create_budget(
    batch_id: str,
    budget_data: RerunBudgetCreate,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    try:
        return service.create_budget(batch_id, budget_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/request", response_model=RerunResponse)
def request_rerun(
    request: RerunRequest,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    return service.request_rerun(request)


@router.post("/status", response_model=RerunSummaryResponse)
def update_rerun_status(
    update: BudgetStatusUpdate,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    summary = service.update_rerun_status(update)
    if not summary:
        raise HTTPException(status_code=404, detail="Rerun summary not found")
    return summary


@router.post("/manual-correction")
def apply_manual_correction(
    correction: ManualCorrection,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    try:
        return service.apply_manual_correction(correction)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/export")
def export_data(
    filter_params: ExportFilter,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    return service.export_data(
        batch_ids=filter_params.batch_ids,
        start_date=filter_params.start_date,
        end_date=filter_params.end_date,
        reason_codes=filter_params.reason_codes,
        status=filter_params.status
    )


@router.get("/budgets/check/{batch_id}/{reason_code}")
def check_budget(
    batch_id: str,
    reason_code: str,
    db: Session = Depends(get_db)
):
    service = BudgetService(db)
    return service.check_rerun_budget(batch_id, reason_code)
