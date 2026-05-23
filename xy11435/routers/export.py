from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
from collections import defaultdict

from database import get_db
from models import Batch, Receipt, OperationLog
from schemas import ExportSummary

router = APIRouter()

@router.get("/batch/{batch_id}/summary", response_model=ExportSummary)
def get_batch_export_summary(batch_id: int, exported_by: str = "system", db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()
    
    before_freeze_counts = defaultdict(int)
    after_freeze_counts = defaultdict(int)
    manual_reasons = []
    
    for r in receipts:
        if r.before_freeze_status:
            before_freeze_counts[r.before_freeze_status] += 1
        if r.after_freeze_status:
            after_freeze_counts[r.after_freeze_status] += 1
        if r.is_manual_overruled:
            manual_reasons.append({
                "receipt_no": r.receipt_no,
                "room_no": r.room_no,
                "overrule_reason": r.overrule_reason,
                "overruled_by": r.overruled_by,
                "overruled_at": r.overruled_at,
                "original_status": r.before_freeze_status,
                "final_status": r.status
            })
    
    return ExportSummary(
        batch_no=batch.batch_no,
        batch_name=batch.name,
        total_receipts=len(receipts),
        before_freeze=dict(before_freeze_counts),
        after_freeze=dict(after_freeze_counts),
        manual_overruled_count=len(manual_reasons),
        manual_reasons=manual_reasons,
        export_time=datetime.now(),
        exported_by=exported_by
    )

@router.get("/batch/{batch_id}/details")
def get_batch_export_details(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()
    
    details = []
    for r in receipts:
        details.append({
            "receipt_no": r.receipt_no,
            "room_no": r.room_no,
            "guest_name": r.guest_name,
            "exception_type": r.exception_type,
            "exception_desc": r.exception_desc,
            "before_freeze_status": r.before_freeze_status,
            "after_freeze_status": r.after_freeze_status,
            "final_status": r.status,
            "review_result": r.review_result,
            "review_reason": r.review_reason,
            "is_manual_overruled": r.is_manual_overruled,
            "overrule_reason": r.overrule_reason,
            "overruled_by": r.overruled_by,
            "source_file": r.source_file,
            "source_row_no": r.source_row_no,
            "scheduled_clean_date": r.scheduled_clean_date,
            "actual_clean_date": r.actual_clean_date
        })
    
    return {
        "batch_no": batch.batch_no,
        "batch_name": batch.name,
        "is_frozen": batch.is_frozen,
        "frozen_reason": batch.frozen_reason,
        "frozen_at": batch.frozen_at,
        "total_count": len(details),
        "details": details
    }

@router.get("/batch/{batch_id}/failed-list")
def get_failed_items_list(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    failed_logs = db.query(OperationLog).filter(
        OperationLog.batch_id == batch_id,
        OperationLog.remark.like("%失败%")
    ).all()
    
    disputed_receipts = db.query(Receipt).filter(
        Receipt.batch_id == batch_id,
        Receipt.status == "disputed"
    ).all()
    
    return {
        "batch_no": batch.batch_no,
        "disputed_count": len(disputed_receipts),
        "disputed_items": [
            {
                "receipt_no": r.receipt_no,
                "room_no": r.room_no,
                "exception_type": r.exception_type,
                "review_reason": r.review_reason,
                "is_manual_overruled": r.is_manual_overruled
            }
            for r in disputed_receipts
        ],
        "operation_failures": [
            {
                "operation_type": log.operation_type,
                "operator": log.operator,
                "remark": log.remark,
                "operation_time": log.operation_time
            }
            for log in failed_logs
        ]
    }
