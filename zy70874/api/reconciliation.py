from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import get_db
from models import ReconciliationRecord, ReconciliationSummary, ReviewLog, SessionStatus
from schemas import ReconciliationRecordResponse, ReconciliationSummaryResponse, ReviewRequest, ReconciliationResult
from reconciliation_engine import ReconciliationEngine

router = APIRouter()


@router.post("/run", response_model=ReconciliationResult)
def run_reconciliation(
    film_code: str = None,
    db: Session = Depends(get_db)
):
    engine = ReconciliationEngine(db)
    result = engine.run_reconciliation(film_code)
    return result


@router.get("/records", response_model=List[ReconciliationRecordResponse])
def get_reconciliation_records(
    batch_id: str = None,
    status: SessionStatus = None,
    film_code: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationRecord)
    
    if batch_id:
        query = query.filter(ReconciliationRecord.reconciliation_batch == batch_id)
    if status:
        query = query.filter(ReconciliationRecord.status == status)
    if film_code:
        query = query.join(ReconciliationRecord.session).filter(
            ReconciliationRecord.session.has(film_code=film_code)
        )
    
    return query.offset(skip).limit(limit).all()


@router.get("/records/{record_id}", response_model=ReconciliationRecordResponse)
def get_reconciliation_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    
    return record


@router.post("/records/{record_id}/review", response_model=ReconciliationRecordResponse)
def review_record(
    record_id: int,
    review_data: ReviewRequest,
    db: Session = Depends(get_db)
):
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == record_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    
    previous_status = record.status
    
    if review_data.adjust_expected_subsidy is not None:
        record.expected_subsidy = review_data.adjust_expected_subsidy
    if review_data.adjust_actual_subsidy is not None:
        record.actual_subsidy = review_data.adjust_actual_subsidy
    if review_data.adjust_min_boxoffice is not None:
        record.expected_min_boxoffice = review_data.adjust_min_boxoffice
    if review_data.adjust_refund_deduction is not None:
        record.refund_deduction = review_data.adjust_refund_deduction
    
    record.subsidy_discrepancy = record.actual_subsidy - record.expected_subsidy
    record.min_boxoffice_discrepancy = record.expected_min_boxoffice - record.actual_boxoffice
    record.total_discrepancy = (
        record.subsidy_discrepancy +
        record.min_boxoffice_discrepancy +
        record.refund_deduction
    )
    
    record.status = review_data.status
    record.reviewer_notes = review_data.notes
    record.reviewed_by = review_data.reviewer
    record.reviewed_at = datetime.now()
    
    if review_data.discrepancy_explanation:
        if record.discrepancy_explanation:
            record.discrepancy_explanation += "\n" + f"【复核说明】{review_data.discrepancy_explanation}"
        else:
            record.discrepancy_explanation = f"【复核说明】{review_data.discrepancy_explanation}"
    
    review_log = ReviewLog(
        reconciliation_id=record.id,
        previous_status=previous_status,
        new_status=review_data.status,
        reviewer=review_data.reviewer,
        notes=review_data.notes,
        discrepancy_explanation=review_data.discrepancy_explanation
    )
    db.add(review_log)
    
    engine = ReconciliationEngine(db)
    engine.update_summary(record.reconciliation_batch)
    
    db.commit()
    db.refresh(record)
    
    return record


@router.get("/summaries", response_model=List[ReconciliationSummaryResponse])
def get_reconciliation_summaries(
    batch_id: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ReconciliationSummary)
    if batch_id:
        query = query.filter(ReconciliationSummary.reconciliation_batch == batch_id)
    return query.offset(skip).limit(limit).all()


@router.post("/recalculate/{batch_id}")
def recalculate_batch(
    batch_id: str,
    db: Session = Depends(get_db)
):
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch == batch_id
    ).all()
    
    if not records:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    engine = ReconciliationEngine(db)
    daily_subsidy_tracker = {}
    total_subsidy_tracker = {}
    
    for record in records:
        session = record.session
        boxoffice = record.boxoffice
        contract = record.contract
        
        if not session or not boxoffice or not contract:
            continue
        
        new_record, _ = engine.process_single_session(
            session, boxoffice, contract,
            daily_subsidy_tracker, total_subsidy_tracker
        )
        
        record.expected_subsidy = new_record.expected_subsidy
        record.actual_subsidy = new_record.actual_subsidy
        record.subsidy_discrepancy = new_record.subsidy_discrepancy
        record.expected_min_boxoffice = new_record.expected_min_boxoffice
        record.min_boxoffice_discrepancy = new_record.min_boxoffice_discrepancy
        record.refund_deduction = new_record.refund_deduction
        record.total_discrepancy = new_record.total_discrepancy
        record.discrepancy_types = new_record.discrepancy_types
        record.discrepancy_explanation = new_record.discrepancy_explanation
        
        if abs(record.total_discrepancy) < 0.01 and record.status == SessionStatus.DISPUTED:
            record.status = SessionStatus.MATCHED
    
    engine.update_summary(batch_id)
    db.commit()
    
    return {"message": "重新计算完成", "batch_id": batch_id, "updated_records": len(records)}
