from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import CorrectionCreate, CorrectionResponse
from services import create_correction
from models import Correction

router = APIRouter()


@router.post("/", response_model=CorrectionResponse)
def create_correction_endpoint(correction_data: CorrectionCreate, db: Session = Depends(get_db)):
    try:
        correction = create_correction(db, correction_data)
        return correction
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/material/{material_id}", response_model=List[CorrectionResponse])
def get_material_corrections(material_id: int, db: Session = Depends(get_db)):
    corrections = db.query(Correction).filter(Correction.material_id == material_id).order_by(Correction.created_at.desc()).all()
    return corrections


@router.get("/{correction_id}", response_model=CorrectionResponse)
def get_correction(correction_id: int, db: Session = Depends(get_db)):
    correction = db.query(Correction).filter(Correction.id == correction_id).first()
    if not correction:
        raise HTTPException(status_code=404, detail="修正记录不存在")
    return correction
