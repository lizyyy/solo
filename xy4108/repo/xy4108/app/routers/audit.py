from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuditLog, AuditAction
from ..schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["审计流水"])


@router.get("/", response_model=List[AuditLogResponse])
def list_audit_logs(
    action: Optional[AuditAction] = None,
    entity_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    
    return query.order_by(AuditLog.timestamp.desc()).limit(limit).all()


@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="审计记录不存在")
    return log
