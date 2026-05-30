from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import TransactionFlow
from schemas import TransactionFlowCreate, TransactionFlowOut

router = APIRouter(prefix="/api/transaction", tags=["交易流水"])


@router.post("/", response_model=TransactionFlowOut)
def create_transaction(data: TransactionFlowCreate, db: Session = Depends(get_db)):
    existing = db.query(TransactionFlow).filter(TransactionFlow.transaction_no == data.transaction_no).first()
    if existing:
        existing.is_supplementary = 1
        existing.version += 1
        for k, v in data.model_dump(exclude={"transaction_no", "version", "is_supplementary"}).items():
            if v is not None:
                setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing

    tx = TransactionFlow(**data.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@router.post("/batch", response_model=List[TransactionFlowOut])
def batch_create_transactions(data: List[TransactionFlowCreate], db: Session = Depends(get_db)):
    results = []
    for item in data:
        existing = db.query(TransactionFlow).filter(TransactionFlow.transaction_no == item.transaction_no).first()
        if existing:
            existing.is_supplementary = 1
            existing.version += 1
            for k, v in item.model_dump(exclude={"transaction_no", "version", "is_supplementary"}).items():
                if v is not None:
                    setattr(existing, k, v)
            results.append(existing)
        else:
            tx = TransactionFlow(**item.model_dump())
            db.add(tx)
            results.append(tx)
    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/", response_model=List[TransactionFlowOut])
def list_transactions(
    customer_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    is_supplementary: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(TransactionFlow)
    if customer_id:
        query = query.filter(TransactionFlow.customer_id == customer_id)
    if transaction_type:
        query = query.filter(TransactionFlow.transaction_type == transaction_type)
    if is_supplementary is not None:
        query = query.filter(TransactionFlow.is_supplementary == is_supplementary)
    return query.offset(skip).limit(limit).all()


@router.get("/{transaction_id}", response_model=TransactionFlowOut)
def get_transaction(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.query(TransactionFlow).filter(TransactionFlow.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="交易流水不存在")
    return tx
