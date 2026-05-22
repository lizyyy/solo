from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, allow_supervisor, allow_all_authenticated
from app.models import User, AuditLog
from app.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["审计日志"])


@router.get("", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_supervisor)
):
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs


@router.get("/my", response_model=List[AuditLogResponse])
def get_my_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    action: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(allow_all_authenticated)
):
    query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)

    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs
