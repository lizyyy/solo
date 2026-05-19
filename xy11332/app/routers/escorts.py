from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import schemas, crud

router = APIRouter()


@router.post("/", response_model=schemas.Escort)
def create_escort(escort: schemas.EscortCreate, db: Session = Depends(get_db)):
    return crud.create_escort(db, escort)


@router.get("/{escort_id}", response_model=schemas.Escort)
def get_escort(escort_id: int, db: Session = Depends(get_db)):
    db_escort = crud.get_escort(db, escort_id)
    if not db_escort:
        raise HTTPException(status_code=404, detail="陪检员不存在")
    return db_escort


@router.get("/", response_model=List[schemas.Escort])
def get_escorts(skip: int = 0, limit: int = 100, active_only: bool = True, db: Session = Depends(get_db)):
    return crud.get_escorts(db, skip, limit, active_only)