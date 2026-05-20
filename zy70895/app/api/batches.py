from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import schemas, crud

router = APIRouter(prefix="/batches", tags=["批次管理"])


@router.post("/", response_model=schemas.Batch)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    db_batch = crud.get_batch_by_number(db, batch_number=batch.batch_number)
    if db_batch:
        raise HTTPException(status_code=400, detail="批次号已存在")
    return crud.create_batch(db=db, batch=batch)


@router.get("/", response_model=List[schemas.Batch])
def read_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = crud.get_batches(db, skip=skip, limit=limit)
    return batches


@router.get("/{batch_id}", response_model=schemas.Batch)
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch
