from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import DrillRecord
from schemas import DrillRecordCreate, DrillRecordResponse, ImportResult

router = APIRouter(prefix="/api/drills", tags=["drills"])


@router.post("/", response_model=DrillRecordResponse)
def create_drill(drill: DrillRecordCreate, db: Session = Depends(get_db)):
    db_drill = DrillRecord(**drill.model_dump())
    db.add(db_drill)
    db.commit()
    db.refresh(db_drill)
    return db_drill


@router.get("/", response_model=List[DrillRecordResponse])
def get_drills(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    drills = db.query(DrillRecord).offset(skip).limit(limit).all()
    return drills


@router.get("/{drill_id}", response_model=DrillRecordResponse)
def get_drill(drill_id: int, db: Session = Depends(get_db)):
    drill = db.query(DrillRecord).filter(DrillRecord.id == drill_id).first()
    if drill is None:
        raise HTTPException(status_code=404, detail="Drill record not found")
    return drill


@router.delete("/{drill_id}")
def delete_drill(drill_id: int, db: Session = Depends(get_db)):
    db_drill = db.query(DrillRecord).filter(DrillRecord.id == drill_id).first()
    if db_drill is None:
        raise HTTPException(status_code=404, detail="Drill record not found")
    
    db.delete(db_drill)
    db.commit()
    return {"message": "Drill record deleted successfully"}


@router.post("/import", response_model=ImportResult)
def import_drills(drills_data: List[DrillRecordCreate], db: Session = Depends(get_db)):
    imported_count = 0
    failed_count = 0
    errors = []
    
    for idx, drill_data in enumerate(drills_data):
        try:
            db_drill = DrillRecord(**drill_data.model_dump())
            db.add(db_drill)
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
def clear_all_drills(db: Session = Depends(get_db)):
    count = db.query(DrillRecord).delete()
    db.commit()
    return {"message": f"Cleared {count} drill records"}
