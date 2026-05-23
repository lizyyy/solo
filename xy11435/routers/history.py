from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import OperationLog, DiffRecord
from schemas import OperationLogResponse, DiffRecordResponse

router = APIRouter()

@router.get("/batch/{batch_id}/logs", response_model=List[OperationLogResponse])
def get_batch_operation_logs(
    batch_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logs = db.query(OperationLog).filter(
        OperationLog.batch_id == batch_id
    ).order_by(OperationLog.operation_time.desc()).offset(skip).limit(limit).all()
    return logs

@router.get("/receipt/{receipt_id}/logs", response_model=List[OperationLogResponse])
def get_receipt_operation_logs(
    receipt_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logs = db.query(OperationLog).filter(
        OperationLog.receipt_id == receipt_id
    ).order_by(OperationLog.operation_time.desc()).offset(skip).limit(limit).all()
    return logs

@router.get("/batch/{batch_id}/diffs", response_model=List[DiffRecordResponse])
def get_batch_diff_records(
    batch_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    diffs = db.query(DiffRecord).filter(
        DiffRecord.batch_id == batch_id
    ).order_by(DiffRecord.changed_at.desc()).offset(skip).limit(limit).all()
    return diffs

@router.get("/receipt/{receipt_id}/diffs", response_model=List[DiffRecordResponse])
def get_receipt_diff_records(
    receipt_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    diffs = db.query(DiffRecord).filter(
        DiffRecord.receipt_id == receipt_id
    ).order_by(DiffRecord.changed_at.desc()).offset(skip).limit(limit).all()
    return diffs

@router.get("/logs/{log_id}/compare")
def compare_operation_states(log_id: int, db: Session = Depends(get_db)):
    log = db.query(OperationLog).filter(OperationLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="操作日志不存在")
    
    return {
        "log_id": log.id,
        "operation_type": log.operation_type,
        "operator": log.operator,
        "operation_time": log.operation_time,
        "before_state": log.before_state,
        "after_state": log.after_state,
        "diff_summary": log.diff_summary,
        "remark": log.remark
    }
