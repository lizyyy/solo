from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, RoleEnum, AuditLog
from app.schemas import AuditLogResponse
from app.security import RoleChecker

router = APIRouter(prefix="/audit", tags=["审计日志"])


@router.get("/logs", response_model=dict)
def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    user_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()

    return {
        "items": logs,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/logs/{log_id}", response_model=AuditLogResponse)
def get_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    from fastapi import HTTPException
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="审计日志不存在")
    return log


@router.get("/actions")
def get_audit_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    actions = db.query(AuditLog.action).distinct().all()
    return {
        "actions": [a[0] for a in actions],
        "resource_types": [r[0] for r in db.query(AuditLog.resource_type).distinct().all() if r[0]]
    }


@router.get("/statistics")
def get_audit_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    from sqlalchemy import func
    from datetime import datetime, timedelta

    seven_days_ago = datetime.now() - timedelta(days=7)

    stats = {
        "total_logs": db.query(AuditLog).count(),
        "last_7_days": db.query(AuditLog).filter(AuditLog.created_at >= seven_days_ago).count(),
        "by_action": {},
        "by_role": {},
        "sensitive_operations": db.query(AuditLog).filter(AuditLog.is_sensitive == True).count()
    }

    action_counts = db.query(
        AuditLog.action, func.count(AuditLog.id)
    ).group_by(AuditLog.action).all()
    for action, count in action_counts:
        stats["by_action"][action] = count

    role_counts = db.query(
        AuditLog.role, func.count(AuditLog.id)
    ).group_by(AuditLog.role).all()
    for role, count in role_counts:
        if role:
            stats["by_role"][role.value if hasattr(role, 'value') else role] = count

    return stats
