from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.schemas import (
    FrozenBalanceCreate,
    FrozenBalanceResponse,
    PointTransactionCreate,
    PointTransactionResponse
)
from app.services.ledger_service import LedgerService
from app.models import FrozenBalance, PointTransaction

router = APIRouter(prefix="/points", tags=["积分操作"])

@router.post("/freeze", response_model=FrozenBalanceResponse)
def freeze_points(frozen: FrozenBalanceCreate, db: Session = Depends(get_db)):
    service = LedgerService(db)
    return service.freeze_points(frozen)

@router.get("/frozen", response_model=List[FrozenBalanceResponse])
def list_frozen(member_id: str = None, db: Session = Depends(get_db)):
    query = db.query(FrozenBalance)
    if member_id:
        query = query.filter(FrozenBalance.member_id == member_id)
    return query.all()

@router.post("/consume", response_model=PointTransactionResponse)
def consume_points(tx: PointTransactionCreate, db: Session = Depends(get_db)):
    tx.tx_type = "consume"
    service = LedgerService(db)
    return service.create_transaction(tx)

@router.post("/expire", response_model=PointTransactionResponse)
def expire_points(
    member_id: str,
    batch_id: int,
    points: int,
    operator: str,
    tx_no: str = None,
    db: Session = Depends(get_db)
):
    service = LedgerService(db)
    return service.expire_points(member_id, batch_id, points, operator, tx_no)

@router.post("/refund", response_model=PointTransactionResponse)
def refund_points(
    member_id: str,
    batch_id: int,
    points: int,
    related_tx_id: int,
    operator: str,
    tx_no: str = None,
    db: Session = Depends(get_db)
):
    service = LedgerService(db)
    return service.refund_points(member_id, batch_id, points, related_tx_id, operator, tx_no)

@router.get("/transactions", response_model=List[PointTransactionResponse])
def list_transactions(
    member_id: str = None,
    tx_type: str = None,
    batch_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(PointTransaction)
    if member_id:
        query = query.filter(PointTransaction.member_id == member_id)
    if tx_type:
        query = query.filter(PointTransaction.tx_type == tx_type)
    if batch_id:
        query = query.filter(PointTransaction.batch_id == batch_id)
    return query.order_by(PointTransaction.created_at.desc()).all()

@router.get("/transactions/{tx_id}", response_model=PointTransactionResponse)
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(PointTransaction).filter(PointTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="交易不存在")
    return tx

@router.get("/balance/{member_id}")
def get_member_balance(member_id: str, db: Session = Depends(get_db)):
    service = LedgerService(db)
    return service.calculate_member_balance(member_id)
