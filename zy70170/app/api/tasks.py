from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.schemas import (
    TaskCreate, TaskOut, TaskDetail, TaskListOut,
    TaskHistoryOut, HistoryListOut, BlockPointOut, MessageOut
)
from app.models import Task, TaskHistory, TaskStatus
from app.core.scheduler import MainScheduler

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post("/submit", response_model=TaskOut)
def submit_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    scheduler = MainScheduler(db)
    task = scheduler.submit_task(
        name=task_data.name,
        user_id=task_data.user_id,
        priority=task_data.priority,
        estimated_duration_minutes=task_data.estimated_duration_minutes,
        timeout_minutes=task_data.timeout_minutes,
        max_retries=task_data.max_retries,
        command=task_data.command,
        script_path=task_data.script_path,
        output_path=task_data.output_path
    )
    return task


@router.get("/", response_model=TaskListOut)
def list_tasks(
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Task)
    
    if user_id:
        query = query.filter(Task.user_id == user_id)
    if status:
        query = query.filter(Task.status == status)
    
    total = query.count()
    items = query.order_by(Task.id.desc()).offset(offset).limit(limit).all()
    
    return TaskListOut(total=total, items=items)


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task


@router.get("/{task_id}/history", response_model=HistoryListOut)
def get_task_history(
    task_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    histories = (
        db.query(TaskHistory)
        .filter(TaskHistory.task_id == task.id)
        .order_by(TaskHistory.id.desc())
        .limit(limit)
        .all()
    )
    
    total = db.query(TaskHistory).filter(TaskHistory.task_id == task.id).count()
    return HistoryListOut(total=total, items=histories)


@router.get("/{task_id}/block-point", response_model=BlockPointOut)
def get_block_point(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    scheduler = MainScheduler(db)
    return scheduler.get_task_block_point(task)


@router.post("/{task_id}/cancel", response_model=MessageOut)
def cancel_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    scheduler = MainScheduler(db)
    success = scheduler.cancel_task(task)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task {task_id}: task is already in {task.status} state"
        )
    
    return MessageOut(
        success=True,
        message=f"Task {task_id} cancelled successfully"
    )


@router.post("/{task_id}/complete", response_model=MessageOut)
def complete_task(
    task_id: str,
    success: bool = True,
    reason: str = "",
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    if task.status != TaskStatus.RUNNING:
        raise HTTPException(
            status_code=400,
            detail=f"Task {task_id} is not running (current status: {task.status})"
        )
    
    scheduler = MainScheduler(db)
    scheduler.task_executor.complete_task(task, success=success, reason=reason)
    
    return MessageOut(
        success=True,
        message=f"Task {task_id} marked as {'succeeded' if success else 'failed'}"
    )


@router.get("/queue/overview")
def get_queue_overview(db: Session = Depends(get_db)):
    queued_tasks = (
        db.query(Task)
        .filter(Task.status == TaskStatus.QUEUED)
        .order_by(Task.priority.desc(), Task.queued_at.asc())
        .all()
    )
    
    return {
        "total_queued": len(queued_tasks),
        "queue": [
            {
                "position": t.queue_position,
                "task_id": t.task_id,
                "name": t.name,
                "user_id": t.user_id,
                "priority": t.priority,
                "queued_at": t.queued_at.isoformat() if t.queued_at else None
            }
            for t in queued_tasks
        ]
    }
