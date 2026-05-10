from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReceiptStatus
from app.schemas import ReceiptCreate, ReceiptOut, MatchResult
from app.services.receipt_service import ReceiptService

router = APIRouter(prefix="/receipts", tags=["收款流水"])

service = ReceiptService()


@router.post("", response_model=ReceiptOut, status_code=201)
def create_receipt(data: ReceiptCreate, db: Session = Depends(get_db)):
    return service.create(db, data)


@router.get("", response_model=List[ReceiptOut])
def list_receipts(
    status: Optional[ReceiptStatus] = Query(None),
    db: Session = Depends(get_db),
):
    return service.list(db, status=status)


@router.get("/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    return service.get(db, receipt_id)


@router.post("/{receipt_id}/match", response_model=MatchResult)
def match_contracts(receipt_id: int, db: Session = Depends(get_db)):
    return service.match_contracts(db, receipt_id)


@router.post("/{receipt_id}/mark-matched", response_model=ReceiptOut)
def mark_matched(receipt_id: int, db: Session = Depends(get_db)):
    return service.mark_matched(db, receipt_id)
