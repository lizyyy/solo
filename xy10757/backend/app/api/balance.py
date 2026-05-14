from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.schemas import BalanceSnapshotCreate, BalanceSnapshotResponse
from app.services.ledger_service import LedgerService
from app.models import BalanceSnapshot

router = APIRouter(prefix="/balance", tags=["余额快照"])

@router.post("/snapshot", response_model=BalanceSnapshotResponse)
def create_snapshot(snapshot: BalanceSnapshotCreate, db: Session = Depends(get_db)):
    service = LedgerService(db)
    return service.create_snapshot(snapshot)

@router.get("/snapshots", response_model=List[BalanceSnapshotResponse])
def list_snapshots(member_id: str = None, db: Session = Depends(get_db)):
    query = db.query(BalanceSnapshot)
    if member_id:
        query = query.filter(BalanceSnapshot.member_id == member_id)
    return query.order_by(BalanceSnapshot.snapshot_date.desc()).all()

@router.get("/snapshots/{snapshot_id}", response_model=BalanceSnapshotResponse)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(BalanceSnapshot).filter(BalanceSnapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    return snapshot
