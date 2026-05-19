from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.models.models import ErrorRecord, User
from app.schemas.schemas import ErrorRecordResponse, ErrorRecordResolve

router = APIRouter(prefix="/errors", tags=["错误记录"])


@router.get("/", response_model=List[ErrorRecordResponse])
def get_error_records(
    session_id: str = None,
    status: str = None,
    error_type: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ErrorRecord)
    if session_id:
        query = query.filter(ErrorRecord.import_session_id == session_id)
    if status:
        query = query.filter(ErrorRecord.status == status)
    if error_type:
        query = query.filter(ErrorRecord.error_type == error_type)
    return query.order_by(ErrorRecord.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{error_id}", response_model=ErrorRecordResponse)
def get_error_record(
    error_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    error = db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="错误记录不存在")
    return error


@router.put("/{error_id}", response_model=ErrorRecordResponse)
def resolve_error_record(
    error_id: int,
    resolve_data: ErrorRecordResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    error = db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="错误记录不存在")
    
    error.status = resolve_data.status
    if resolve_data.suggestion:
        error.suggestion = resolve_data.suggestion
    error.resolved_by = current_user.username
    error.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(error)
    return error


@router.delete("/{error_id}")
def delete_error_record(
    error_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    error = db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="错误记录不存在")
    
    db.delete(error)
    db.commit()
    return {"message": "错误记录已删除"}
