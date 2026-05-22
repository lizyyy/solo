from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_active_user, RoleChecker
from app.core.config import UserRole, TaskStatus, RetryCategory
from app.models import User, RepairTask, ProcessLog, FailedRecord
from app.schemas import RepairTaskResponse, TaskProcessRequest, ProcessLogResponse

router = APIRouter()

@router.get("/", response_model=list[RepairTaskResponse])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    status: TaskStatus = None,
    retry_category: RetryCategory = None,
    order_id: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(RepairTask)
    
    if status:
        query = query.filter(RepairTask.status == status)
    if retry_category:
        query = query.filter(RepairTask.retry_category == retry_category)
    if order_id:
        query = query.filter(RepairTask.order_id == order_id)
    
    tasks = query.order_by(RepairTask.created_at.desc()).offset(skip).limit(limit).all()
    return tasks

@router.get("/{task_id}", response_model=RepairTaskResponse)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/{task_id}/logs", response_model=list[ProcessLogResponse])
def get_task_logs(
    task_id: str,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    logs = db.query(ProcessLog).filter(
        ProcessLog.task_id == task_id
    ).order_by(ProcessLog.performed_at.desc()).offset(skip).limit(limit).all()
    return logs

@router.post("/{task_id}/retry")
async def retry_task(
    task_id: str,
    request_data: TaskProcessRequest,
    request: Request,
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status not in [TaskStatus.FAILED.value, TaskStatus.DEAD_LETTER.value, TaskStatus.RETRYING.value]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry task with status: {task.status}"
        )
    
    status_before = task.status
    
    if request_data.new_retry_category:
        task.retry_category = request_data.new_retry_category.value
    
    task.retry_count = 0 if request_data.force_retry else task.retry_count
    task.status = TaskStatus.PENDING.value
    task.next_retry_at = None
    task.last_retry_at = datetime.utcnow()
    task.manual_review_required = False
    
    log = ProcessLog(
        task_id=task_id,
        action="manual_retry",
        status_before=status_before,
        status_after=TaskStatus.PENDING.value,
        details={
            "force_retry": request_data.force_retry,
            "new_retry_category": request_data.new_retry_category.value if request_data.new_retry_category else None,
            "notes": request_data.notes
        },
        performed_by=current_user.id,
        ip_address=request.client.host if request.client else None
    )
    db.add(log)
    
    failed_records = db.query(FailedRecord).filter(
        FailedRecord.task_id == task_id,
        FailedRecord.is_resolved == False
    ).all()
    for fr in failed_records:
        fr.is_resolved = True
        fr.resolved_at = datetime.utcnow()
        fr.resolved_by = current_user.id
        fr.resolution_notes = request_data.notes or "Manual retry initiated"
    
    db.commit()
    
    from main import queue_manager
    await queue_manager.task_queue.put(task_id)
    
    return {"message": "Task queued for retry", "task_id": task_id}

@router.post("/{task_id}/manual-review")
def mark_for_manual_review(
    task_id: str,
    notes: str = None,
    current_user: User = Depends(RoleChecker([UserRole.REVIEWER, UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    status_before = task.status
    task.status = TaskStatus.MANUAL_REVIEW.value
    task.manual_review_required = True
    
    log = ProcessLog(
        task_id=task_id,
        action="mark_manual_review",
        status_before=status_before,
        status_after=TaskStatus.MANUAL_REVIEW.value,
        details={"notes": notes},
        performed_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return {"message": "Task marked for manual review", "task_id": task_id}

@router.post("/{task_id}/close")
def close_task(
    task_id: str,
    notes: str = None,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    status_before = task.status
    task.status = TaskStatus.CLOSED.value
    task.closed_at = datetime.utcnow()
    task.closed_by = current_user.id
    
    log = ProcessLog(
        task_id=task_id,
        action="close_task",
        status_before=status_before,
        status_after=TaskStatus.CLOSED.value,
        details={"notes": notes},
        performed_by=current_user.id
    )
    db.add(log)
    db.commit()
    
    return {"message": "Task closed", "task_id": task_id}

@router.get("/{task_id}/trace")
def get_task_trace(
    task_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    logs = db.query(ProcessLog).filter(
        ProcessLog.task_id == task_id
    ).order_by(ProcessLog.performed_at).all()
    
    failed_records = db.query(FailedRecord).filter(
        FailedRecord.task_id == task_id
    ).order_by(FailedRecord.created_at).all()
    
    return {
        "task_id": task_id,
        "current_status": task.status,
        "retry_count": task.retry_count,
        "order_id": task.order_id,
        "process_flow": [
            {
                "timestamp": log.performed_at,
                "action": log.action,
                "status_before": log.status_before,
                "status_after": log.status_after,
                "details": log.details
            }
            for log in logs
        ],
        "failed_attempts": [
            {
                "attempt": fr.retry_attempt,
                "category": fr.error_category,
                "message": fr.error_message,
                "timestamp": fr.created_at,
                "resolved": fr.is_resolved
            }
            for fr in failed_records
        ]
    }
