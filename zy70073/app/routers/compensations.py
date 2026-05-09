from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import CompensationType
from app.schemas.schemas import CompensationTaskResponse
from app.services.compensation_service import CompensationHandler

router = APIRouter(prefix="/compensations", tags=["compensations"])


class CreateCompensationRequest(BaseModel):
    contract_id: int
    task_type: CompensationType
    task_data: Dict[str, Any]
    warning_id: Optional[int] = None
    max_retries: Optional[int] = None


@router.post("", response_model=CompensationTaskResponse, status_code=status.HTTP_201_CREATED)
def create_compensation_task(
    data: CreateCompensationRequest,
    db: Session = Depends(get_db),
):
    handler = CompensationHandler(db)
    task = handler.create_compensation_task(
        contract_id=data.contract_id,
        task_type=data.task_type,
        task_data=data.task_data,
        warning_id=data.warning_id,
        max_retries=data.max_retries,
    )
    return task


@router.get("", response_model=List[CompensationTaskResponse])
def list_compensation_tasks(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
):
    from app.models.enums import CompensationStatus
    from app.models.models import CompensationTask

    query = db.query(CompensationTask)
    if status_filter:
        query = query.filter(CompensationTask.status == status_filter)
    return query.order_by(CompensationTask.created_at.desc()).all()


@router.get("/{task_id}", response_model=CompensationTaskResponse)
def get_compensation_task(task_id: int, db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    task = handler.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"补偿任务 {task_id} 不存在",
        )
    return task


@router.post("/{task_id}/execute")
def execute_task(task_id: int, db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    task = handler.get_task(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"补偿任务 {task_id} 不存在",
        )
    success, message = handler.execute_task(task)
    return {"success": success, "message": message}


@router.post("/{task_id}/retry")
def retry_task(task_id: int, db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    success, message = handler.retry_task(task_id)
    return {"success": success, "message": message}


@router.post("/{task_id}/mark-for-retry", response_model=Optional[CompensationTaskResponse])
def mark_for_retry(task_id: int, db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    task = handler.mark_for_retry(task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法标记为重试，检查任务状态或重试次数",
        )
    return task


@router.post("/execute-all-pending")
def execute_all_pending(db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    results = handler.execute_all_pending()
    return results


@router.get("/query/pending", response_model=List[CompensationTaskResponse])
def get_pending_tasks(db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    return handler.get_pending_tasks()


@router.get("/query/failed", response_model=List[CompensationTaskResponse])
def get_failed_tasks(db: Session = Depends(get_db)):
    handler = CompensationHandler(db)
    return handler.get_failed_tasks()
