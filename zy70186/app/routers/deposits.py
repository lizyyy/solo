from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import (
    DepositRequest, ReleaseRequest, TransactionResponse,
    PaymentReceiptResponse, MessageResponse
)
from app.services import DepositService, BusinessException
from app.models import DepositTransaction

router = APIRouter(prefix="/deposits", tags=["保证金管理"])


@router.post("/deposit", response_model=MessageResponse)
def process_deposit(data: DepositRequest, db: Session = Depends(get_db)):
    try:
        result = DepositService.process_deposit(db, data)
        return MessageResponse(
            success=result["success"],
            message=result["message"],
            data={
                "is_duplicate": result["is_duplicate"],
                "transaction_id": result["transaction"].id,
                "transaction_no": result["transaction"].transaction_no
            }
        )
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/release", response_model=MessageResponse)
def process_release(data: ReleaseRequest, db: Session = Depends(get_db)):
    try:
        result = DepositService.process_release(db, data)
        return MessageResponse(
            success=result["success"],
            message=result["message"],
            data={
                "is_duplicate": result["is_duplicate"],
                "transaction_id": result["transaction"].id,
                "transaction_no": result["transaction"].transaction_no
            }
        )
    except BusinessException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/transactions", response_model=List[TransactionResponse])
def list_transactions(contract_id: int = None, db: Session = Depends(get_db)):
    query = db.query(DepositTransaction)
    if contract_id:
        query = query.filter(DepositTransaction.contract_id == contract_id)
    return query.order_by(DepositTransaction.created_at.desc()).all()


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(DepositTransaction).filter(
        DepositTransaction.id == transaction_id
    ).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="交易不存在")
    return transaction


@router.get("/receipts", response_model=List[PaymentReceiptResponse])
def list_receipts(contract_id: int = None, db: Session = Depends(get_db)):
    from app.models import PaymentReceipt, DepositAccount
    
    query = db.query(PaymentReceipt)
    if contract_id:
        query = query.join(DepositAccount).filter(
            DepositAccount.contract_id == contract_id
        )
    return query.order_by(PaymentReceipt.created_at.desc()).all()


@router.post("/check-idempotent")
def check_idempotent(key: str, db: Session = Depends(get_db)):
    transaction = DepositService.check_idempotency(db, key)
    if transaction:
        return {
            "exists": True,
            "status": transaction.status.value,
            "transaction_no": transaction.transaction_no
        }
    return {"exists": False}
