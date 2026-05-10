from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import BackgroundTaskResponse, RetryTaskRequest, MessageResponse
from app.services import TaskService, BusinessException
from app.models import BackgroundTask

router = APIRouter(prefix="/tasks", tags=["后台任务"])


@router.get("", response_model=List[BackgroundTaskResponse])
def list_tasks(
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(BackgroundTask)
    if status:
        query = query.filter(BackgroundTask.status == status)
    return query.order_by(BackgroundTask.created_at.desc()).all()


@router.get("/{task_id}", response_model=BackgroundTaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(BackgroundTask).filter(
        BackgroundTask.task_id == task_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/retry", response_model=BackgroundTaskResponse)
def retry_task(data: RetryTaskRequest, db: Session = Depends(get_db)):
    try:
        return TaskService.retry_task(db, data.task_id, data.force)
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/run", response_model=MessageResponse)
def run_scheduler(db: Session = Depends(get_db)):
    result = TaskService.run_scheduler_once(db)
    return MessageResponse(
        success=True,
        message=f"执行了 {result['total_tasks']} 个任务",
        data=result
    )


@router.post("/create-deduct-task")
def create_deduct_task(approval_id: int, db: Session = Depends(get_db)):
    from app.models import PenaltyApproval
    
    approval = db.query(PenaltyApproval).filter(
        PenaltyApproval.id == approval_id
    ).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批单不存在")
    
    task = TaskService.create_task(
        db,
        task_type="retry_deduct",
        related_id=approval.id,
        related_type="PenaltyApproval"
    )
    
    return {
        "task_id": task.task_id,
        "message": "任务已创建，将在下次调度时执行"
    }
