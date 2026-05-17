from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import AuditLog as AuditModel
from schemas import AuditLog

router = APIRouter()


@router.get("/", response_model=List[AuditLog])
def list_audit_logs(weighing_id: int = None, operation_type: str = None,
                    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(AuditModel)
    if weighing_id:
        query = query.filter(AuditModel.weighing_id == weighing_id)
    if operation_type:
        query = query.filter(AuditModel.operation_type == operation_type)
    audit_logs = query.order_by(AuditModel.created_at.desc()).offset(skip).limit(limit).all()
    return audit_logs


@router.get("/{audit_id}", response_model=AuditLog)
def get_audit_log(audit_id: int, db: Session = Depends(get_db)):
    audit = db.query(AuditModel).filter(AuditModel.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="审计日志不存在")
    return audit
