from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas import LabSpaceCreate, LabSpace
from app.models import LabSpace as LabSpaceModel

router = APIRouter(tags=["实验空间"])


@router.get("/", response_model=List[LabSpace])
def get_lab_spaces(db: Session = Depends(get_db)):
    return db.query(LabSpaceModel).all()


@router.get("/{lab_space_id}", response_model=LabSpace)
def get_lab_space(lab_space_id: int, db: Session = Depends(get_db)):
    lab_space = db.query(LabSpaceModel).filter(LabSpaceModel.id == lab_space_id).first()
    if not lab_space:
        raise HTTPException(status_code=404, detail="实验空间不存在")
    return lab_space


@router.post("/", response_model=LabSpace)
def create_lab_space(lab_space: LabSpaceCreate, db: Session = Depends(get_db)):
    db_lab_space = LabSpaceModel(**lab_space.model_dump())
    db.add(db_lab_space)
    db.commit()
    db.refresh(db_lab_space)
    return db_lab_space