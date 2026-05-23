from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TaskStatus, TaskType
from ..schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskListResponse,
    ManualRetryRequest,
    ManualResolveRequest,
)
from ..services import TaskService

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse)
def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    task = TaskService.create_task(
        db,
        task_type=task_data.task_type,
        batch_id=task_data.batch_id,
        parameters=task_data.parameters,
        priority=task_data.priority,
        max_retries=task_data.max_retries,
        created_by=task_data.created_by,
    )
    return TaskResponse.model_validate(task)


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[TaskStatus] = None,
    task_type: Optional[TaskType] = None,
    batch_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    tasks, total = TaskService.list_tasks(
        db,
        status=status,
        task_type=task_type,
        batch_id=batch_id,
        skip=skip,
        limit=page_size,
    )
    return {
        "total": total,
        "items": [TaskResponse.model_validate(t) for t in tasks],
        "page": page,
        "page_size": page_size,
    }


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = TaskService.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse.model_validate(task)


@router.post("/recover")
def recover_tasks_on_startup(db: Session = Depends(get_db)):
    count = TaskService.recover_tasks_on_startup(db)
    return {
        "message": f"Recovered {count} running tasks to pending state",
        "recovered_count": count,
    }


@router.post("/manual-retry")
def manual_retry(request: ManualRetryRequest, db: Session = Depends(get_db)):
    task = TaskService.manual_retry(
        db,
        task_id=request.task_id,
        retried_by=request.retried_by,
        comment=request.comment,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": "Task reset to pending for manual retry",
        "task": TaskResponse.model_validate(task),
    }


@router.post("/manual-resolve")
def manual_resolve(request: ManualResolveRequest, db: Session = Depends(get_db)):
    task = TaskService.manual_resolve(
        db,
        task_id=request.task_id,
        resolved_by=request.resolved_by,
        resolution=request.resolution,
        result=request.result,
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": "Task marked as manually resolved",
        "task": TaskResponse.model_validate(task),
    }


@router.post("/{task_id}/mark-failed")
def mark_permanently_failed(
    task_id: int,
    marked_by: str = Query(...),
    reason: str = Query(...),
    db: Session = Depends(get_db),
):
    task = TaskService.mark_permanently_failed(
        db, task_id=task_id, marked_by=marked_by, reason=reason
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": "Task marked as permanently failed",
        "task": TaskResponse.model_validate(task),
    }
