from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.auth import get_current_active_user, require_roles
from app import models, schemas

router = APIRouter(prefix="/logs", tags=["操作日志"])


@router.get("", response_model=List[schemas.OperationLogResponse])
async def list_operation_logs(
    record_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(
        models.UserRole.REVIEWER,
        models.UserRole.SUPERVISOR,
        models.UserRole.READ_ONLY
    ))
):
    query = db.query(models.OperationLog)
    if record_id:
        query = query.filter(models.OperationLog.record_id == record_id)
    if user_id:
        query = query.filter(models.OperationLog.user_id == user_id)
    if action:
        query = query.filter(models.OperationLog.action == action)
    
    logs = query.order_by(models.OperationLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@router.get("/record/{record_id}", response_model=List[schemas.OperationLogResponse])
async def get_record_logs(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    logs = db.query(models.OperationLog).filter(
        models.OperationLog.record_id == record_id
    ).order_by(models.OperationLog.created_at.asc()).all()
    return logs
