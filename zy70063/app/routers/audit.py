from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import AuditLog
from ..schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["审计日志"])


@router.get("/logs", response_model=List[AuditLogOut])
def list_audit_logs(
    resource_type: str = None,
    resource_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    return query.order_by(AuditLog.created_at.desc()).all()


@router.get("/logs/{log_id}", response_model=AuditLogOut)
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db)
):
    from fastapi import HTTPException
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    return log
