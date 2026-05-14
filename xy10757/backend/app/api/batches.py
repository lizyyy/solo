from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.schemas import PointBatchCreate, PointBatchResponse
from app.services.ledger_service import LedgerService
from app.models import PointBatch

router = APIRouter(prefix="/batches", tags=["积分批次"])

@router.post("/", response_model=PointBatchResponse)
def create_batch(batch: PointBatchCreate, db: Session = Depends(get_db)):
    service = LedgerService(db)
    existing = db.query(PointBatch).filter(PointBatch.batch_no == batch.batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail="批次号已存在")
    return service.create_batch(batch)

@router.get("/", response_model=List[PointBatchResponse])
def list_batches(member_id: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(PointBatch)
    if member_id:
        query = query.filter(PointBatch.member_id == member_id)
    return query.offset(skip).limit(limit).all()

@router.get("/{batch_id}", response_model=PointBatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PointBatch).filter(PointBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch

@router.get("/{batch_id}/chain")
def get_process_chain(batch_id: int, db: Session = Depends(get_db)):
    service = LedgerService(db)
    try:
        return service.get_process_chain(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
