from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.models.database import get_db
from app.models.enums import TaskType
from app.schemas import AsyncTaskResponse
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["任务管理"])


@router.get("", response_model=List[AsyncTaskResponse])
def list_tasks(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    service = TaskService(db)
    if status == "manual":
        return service.get_manual_tasks(skip, limit)
    else:
        return service.get_pending_tasks(limit)


@router.get("/{task_id}", response_model=AsyncTaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/{task_id}/retry")
def retry_task(task_id: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    success = service.retry_manual_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="任务重试失败")
    return {"success": True, "message": "任务已加入重试队列"}


@router.post("/{task_id}/cancel")
def cancel_task(task_id: str, db: Session = Depends(get_db)):
    service = TaskService(db)
    success = service.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=400, detail="任务取消失败")
    return {"success": True, "message": "任务已取消"}


@router.post("/run-pending")
def run_pending_tasks(limit: int = 10, db: Session = Depends(get_db)):
    from app.services.task_service import TaskExecutor
    executor = TaskExecutor(db)
    success_count = executor.run_pending_tasks(limit)
    return {"success": True, "executed_count": success_count}
