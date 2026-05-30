from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import AuditLog
from schemas import AuditLogOut

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    action: Optional[str] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if action:
        query = query.filter(AuditLog.action == action)
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
