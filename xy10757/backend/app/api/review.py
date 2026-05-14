from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.schemas import ManualCorrectionRequest, ComparisonResult, PointTransactionResponse
from app.services.ledger_service import LedgerService
from app.models import ReviewRecord

router = APIRouter(prefix="/review", tags=["比对复核"])

@router.post("/compare/{member_id}/{snapshot_id}", response_model=ComparisonResult)
def compare_balance(member_id: str, snapshot_id: int, db: Session = Depends(get_db)):
    service = LedgerService(db)
    try:
        return service.compare_balance(member_id, snapshot_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/review/{tx_id}", response_model=PointTransactionResponse)
def review_transaction(tx_id: int, reviewer: str, db: Session = Depends(get_db)):
    service = LedgerService(db)
    try:
        return service.review_transaction(tx_id, reviewer)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/correct", response_model=PointTransactionResponse)
def manual_correction(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    service = LedgerService(db)
    try:
        return service.manual_correct(request.tx_id, request.new_points, request.reason, request.operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/records")
def list_review_records(target_type: str = None, db: Session = Depends(get_db)):
    query = db.query(ReviewRecord)
    if target_type:
        query = query.filter(ReviewRecord.target_type == target_type)
    return query.order_by(ReviewRecord.created_at.desc()).all()
