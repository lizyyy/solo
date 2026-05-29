from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services import kiln_service

router = APIRouter(prefix="/kiln", tags=["kiln"])


class KilnRecordCreate(BaseModel):
    experiment_id: int
    formula_id: Optional[int] = None
    target_temp: Optional[float] = None
    temp_curve: Optional[list[dict]] = None
    soak_duration_min: Optional[float] = None


class KilnRecordOut(BaseModel):
    id: int
    experiment_id: int
    formula_id: Optional[int]
    target_temp: Optional[float]
    temp_curve: Optional[list[dict]]
    soak_duration_min: Optional[float]
    source: str

    class Config:
        from_attributes = True


@router.post("", response_model=KilnRecordOut)
def create_kiln_record(body: KilnRecordCreate, db: Session = Depends(get_db)):
    return kiln_service.create_kiln_record(
        db,
        body.experiment_id,
        body.formula_id,
        body.target_temp,
        body.temp_curve,
        body.soak_duration_min,
    )


@router.get("/experiment/{experiment_id}", response_model=list[KilnRecordOut])
def list_kiln_records(experiment_id: int, db: Session = Depends(get_db)):
    return kiln_service.list_kiln_records(db, experiment_id)


@router.get("/{record_id}", response_model=KilnRecordOut)
def get_kiln_record(record_id: int, db: Session = Depends(get_db)):
    return kiln_service.get_kiln_record(db, record_id)
