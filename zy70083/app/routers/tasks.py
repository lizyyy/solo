from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict
from ..database import get_db
from ..models import BackgroundTask, TaskStatus
from ..schemas import BackgroundTaskResponse, RetryRequest
from ..services.task_service import TaskService

router = APIRouter(prefix="/api/tasks", tags=["后台任务"])


@router.get("/pending", response_model=List[BackgroundTaskResponse])
def list_pending_tasks(db: Session = Depends(get_db)):
    return TaskService.get_pending_tasks(db)


@router.get("/failed", response_model=List[BackgroundTaskResponse])
def list_failed_tasks(db: Session = Depends(get_db)):
    return TaskService.get_failed_tasks(db)


@router.get("/{task_id}")
def get_task_status(task_id: int, db: Session = Depends(get_db)):
    task = TaskService.get_task_status(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskService.explain_task_status(task)


@router.post("/{task_id}/retry")
def retry_task(
    task_id: int,
    data: RetryRequest = None,
    db: Session = Depends(get_db)
):
    operator = data.operator if data else None
    success, message = TaskService.retry_failed_task(db, task_id, operator)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    task = TaskService.get_task_status(db, task_id)
    return {
        "success": True,
        "message": message,
        "task": TaskService.explain_task_status(task) if task else None
    }


@router.post("/{task_id}/execute")
def execute_task(task_id: int, db: Session = Depends(get_db)):
    task = TaskService.get_task_status(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.task_type == "verification":
        success, message = TaskService.execute_verification_task(db, task)
    elif task.task_type == "public_announcement":
        success, message = TaskService.execute_public_announcement_task(db, task)
    else:
        raise HTTPException(status_code=400, detail=f"未知任务类型: {task.task_type}")

    return {
        "success": success,
        "message": message,
        "task": TaskService.explain_task_status(task)
    }


@router.get("/{task_id}/explain")
def explain_task(task_id: int, db: Session = Depends(get_db)):
    task = TaskService.get_task_status(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskService.explain_task_status(task)
