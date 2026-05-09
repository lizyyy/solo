from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.borrow import BorrowStatus
from app.schemas.borrow import BorrowCreate, BorrowReturn, BorrowUpdate, BorrowResponse
from app.services.borrow_service import BorrowService

router = APIRouter(prefix="/borrows", tags=["borrows"])


@router.post("", response_model=BorrowResponse, status_code=201)
def create_borrow(data: BorrowCreate, db: Session = Depends(get_db)):
    try:
        return BorrowService.create(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[BorrowResponse])
def list_borrows(
    status: Optional[BorrowStatus] = None,
    instrument_id: Optional[int] = None,
    borrower_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return BorrowService.list(db, status=status, instrument_id=instrument_id, borrower_id=borrower_id, skip=skip, limit=limit)


@router.get("/overdue", response_model=List[BorrowResponse])
def get_overdue_borrows(db: Session = Depends(get_db)):
    return BorrowService.get_overdue(db)


@router.get("/check-overdue")
def check_overdue(db: Session = Depends(get_db)):
    count = BorrowService.check_overdue(db)
    return {"overdue_count": count, "checked_at": "now"}


@router.get("/{borrow_id}", response_model=BorrowResponse)
def get_borrow(borrow_id: int, db: Session = Depends(get_db)):
    borrow = BorrowService.get_by_id(db, borrow_id)
    if not borrow:
        raise HTTPException(status_code=404, detail="借用记录不存在")
    return borrow


@router.post("/{borrow_id}/return", response_model=BorrowResponse)
def return_borrow(borrow_id: int, data: BorrowReturn, db: Session = Depends(get_db)):
    try:
        return BorrowService.return_borrow(db, borrow_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{borrow_id}/send-notice")
def send_overdue_notice(borrow_id: int, db: Session = Depends(get_db)):
    try:
        return BorrowService.send_overdue_notice(db, borrow_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
