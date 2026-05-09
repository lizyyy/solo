from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import get_current_user, RoleChecker
from ..models import User, OperationType
from ..schemas import OperationLogResponse, FailedTaskResponse
from ..services import (
    get_operation_logs, get_failed_tasks, retry_failed_task
)

router = APIRouter(prefix="/api", tags=["日志和错误"])

admin_checker = RoleChecker(["admin", "manager"])

def operation_log_to_dict(log):
    return {
        "id": log.id,
        "user_id": log.user_id,
        "reissue_id": log.reissue_id,
        "operation_type": log.operation_type.value,
        "detail": log.detail,
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat() if log.created_at else None
    }

@router.get("/logs")
async def list_operation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user_id: Optional[int] = None,
    operation_type: Optional[OperationType] = None,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    items, total = get_operation_logs(
        db, skip=skip, limit=page_size,
        user_id=user_id, operation_type=operation_type
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [operation_log_to_dict(item) for item in items]
    }

@router.get("/failed-tasks", response_model=List[FailedTaskResponse])
async def list_failed_tasks(
    status: Optional[str] = None,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    return get_failed_tasks(db, status=status)

@router.post("/failed-tasks/{task_id}/retry")
async def retry_task(
    task_id: int,
    current_user: User = Depends(admin_checker),
    db: Session = Depends(get_db)
):
    task = retry_failed_task(db, task_id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="任务不存在")
    return {
        "id": task.id,
        "retry_count": task.retry_count,
        "status": task.status,
        "next_retry_at": task.next_retry_at
    }

@router.get("/statistics")
async def get_system_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from ..services import get_statistics
    return get_statistics(db)
