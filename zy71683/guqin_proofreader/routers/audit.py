from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import AuditLog
from schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["操作日志"])


@router.get("", response_model=List[AuditLogOut])
def query_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    version_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    if version_id:
        q = q.filter(AuditLog.version_id == version_id)
    if action:
        q = q.filter(AuditLog.action == action)
    return q.order_by(AuditLog.created_at.desc()).limit(limit).all()


@router.get("/{log_id}", response_model=AuditLogOut)
def get_audit_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(404, "日志不存在")
    return log
