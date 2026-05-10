from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FailedTask
from app.schemas import FailedTaskResponse, RetryRequest, BatchRetryRequest
from app.services import retry_failed_task

router = APIRouter(prefix="/failed-tasks", tags=["失败任务管理"])


@router.get("", response_model=List[FailedTaskResponse])
def list_failed_tasks(
    is_resolved: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(FailedTask).filter(FailedTask.is_resolved == is_resolved)
    tasks = query.order_by(FailedTask.occurred_at.desc()).all()
    
    return [FailedTaskResponse(
        id=task.id,
        appointment_id=task.appointment_id,
        appointment_no=task.appointment.appointment_no if task.appointment else "",
        task_type=task.task_type,
        task_description=task.task_description,
        error_message=task.error_message,
        error_details=task.error_details,
        occurred_at=task.occurred_at,
        retry_count=task.retry_count,
        max_retries=task.max_retries,
        last_retry_at=task.last_retry_at,
        is_resolved=task.is_resolved,
        resolved_at=task.resolved_at,
        resolution_notes=task.resolution_notes
    ) for task in tasks]


@router.get("/{task_id}", response_model=FailedTaskResponse)
def get_failed_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="失败任务不存在")
    
    return FailedTaskResponse(
        id=task.id,
        appointment_id=task.appointment_id,
        appointment_no=task.appointment.appointment_no if task.appointment else "",
        task_type=task.task_type,
        task_description=task.task_description,
        error_message=task.error_message,
        error_details=task.error_details,
        occurred_at=task.occurred_at,
        retry_count=task.retry_count,
        max_retries=task.max_retries,
        last_retry_at=task.last_retry_at,
        is_resolved=task.is_resolved,
        resolved_at=task.resolved_at,
        resolution_notes=task.resolution_notes
    )


@router.post("/{task_id}/retry")
def retry_single_task(
    task_id: int,
    retry_request: RetryRequest,
    db: Session = Depends(get_db)
):
    result = retry_failed_task(db, task_id, retry_request.operator_name)
    return result


@router.post("/batch-retry")
def retry_batch_tasks(
    batch_request: BatchRetryRequest,
    db: Session = Depends(get_db)
):
    results = []
    for task_id in batch_request.task_ids:
        try:
            result = retry_failed_task(db, task_id, batch_request.operator_name)
            results.append({
                "task_id": task_id,
                "success": result["success"],
                "message": result["message"],
                "action_taken": result["action_taken"]
            })
        except HTTPException as e:
            results.append({
                "task_id": task_id,
                "success": False,
                "message": e.detail,
                "action_taken": "重试失败"
            })
    
    success_count = sum(1 for r in results if r["success"])
    return {
        "total": len(batch_request.task_ids),
        "success": success_count,
        "failed": len(batch_request.task_ids) - success_count,
        "details": results
    }


@router.post("/{task_id}/resolve-manually")
def resolve_task_manually(
    task_id: int,
    resolution_notes: str,
    operator_name: str = None,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    
    task = db.query(FailedTask).filter(FailedTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="失败任务不存在")
    
    if task.is_resolved:
        raise HTTPException(status_code=400, detail="该任务已解决")
    
    task.is_resolved = True
    task.resolved_at = datetime.utcnow()
    task.resolution_notes = f"人工处理 - 操作人: {operator_name or '未知'} - 备注: {resolution_notes}"
    
    db.commit()
    db.refresh(task)
    
    return {
        "success": True,
        "message": "任务已标记为人工处理完成",
        "task_id": task_id
    }
