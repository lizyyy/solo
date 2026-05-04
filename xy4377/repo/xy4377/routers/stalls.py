from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from database import get_db
from models import Stall
from schemas import StallCreate, StallUpdate, StallResponse, ImportResult

router = APIRouter(prefix="/api/stalls", tags=["stalls"])


@router.post("/", response_model=StallResponse)
def create_stall(stall: StallCreate, db: Session = Depends(get_db)):
    db_stall = Stall(**stall.model_dump())
    db.add(db_stall)
    db.commit()
    db.refresh(db_stall)
    return db_stall


@router.get("/", response_model=List[StallResponse])
def get_stalls(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stalls = db.query(Stall).offset(skip).limit(limit).all()
    return stalls


@router.get("/{stall_id}", response_model=StallResponse)
def get_stall(stall_id: int, db: Session = Depends(get_db)):
    stall = db.query(Stall).filter(Stall.id == stall_id).first()
    if stall is None:
        raise HTTPException(status_code=404, detail="Stall not found")
    return stall


@router.put("/{stall_id}", response_model=StallResponse)
def update_stall(stall_id: int, stall: StallUpdate, db: Session = Depends(get_db)):
    db_stall = db.query(Stall).filter(Stall.id == stall_id).first()
    if db_stall is None:
        raise HTTPException(status_code=404, detail="Stall not found")
    
    update_data = stall.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_stall, key, value)
    
    db.commit()
    db.refresh(db_stall)
    return db_stall


@router.delete("/{stall_id}")
def delete_stall(stall_id: int, db: Session = Depends(get_db)):
    db_stall = db.query(Stall).filter(Stall.id == stall_id).first()
    if db_stall is None:
        raise HTTPException(status_code=404, detail="Stall not found")
    
    db.delete(db_stall)
    db.commit()
    return {"message": "Stall deleted successfully"}


@router.post("/import", response_model=ImportResult)
def import_stalls(stalls_data: List[StallCreate], db: Session = Depends(get_db)):
    imported_count = 0
    failed_count = 0
    errors = []
    
    for idx, stall_data in enumerate(stalls_data):
        try:
            db_stall = Stall(**stall_data.model_dump())
            db.add(db_stall)
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"Item {idx + 1}: {str(e)}")
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return ImportResult(
            message="Import failed, rolled back",
            imported_count=0,
            failed_count=imported_count + failed_count,
            errors=[f"Database error: {str(e)}"]
        )
    
    return ImportResult(
        message=f"Import completed: {imported_count} imported, {failed_count} failed",
        imported_count=imported_count,
        failed_count=failed_count,
        errors=errors
    )


@router.delete("/")
def clear_all_stalls(db: Session = Depends(get_db)):
    count = db.query(Stall).delete()
    db.commit()
    return {"message": f"Cleared {count} stalls"}
