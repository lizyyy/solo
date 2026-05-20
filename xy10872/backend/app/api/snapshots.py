from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import BaseSnapshotCreate, BaseSnapshot
from app.models import BaseSnapshot as BaseSnapshotModel

router = APIRouter(tags=["快照"])


@router.get("/", response_model=List[BaseSnapshot])
def get_snapshots(db: Session = Depends(get_db)):
    return db.query(BaseSnapshotModel).all()


@router.get("/{snapshot_id}", response_model=BaseSnapshot)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot = db.query(BaseSnapshotModel).filter(BaseSnapshotModel.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    return snapshot


@router.post("/", response_model=BaseSnapshot)
def create_snapshot(snapshot: BaseSnapshotCreate, db: Session = Depends(get_db)):
    db_snapshot = BaseSnapshotModel(**snapshot.model_dump())
    db.add(db_snapshot)
    db.commit()
    db.refresh(db_snapshot)
    return db_snapshot