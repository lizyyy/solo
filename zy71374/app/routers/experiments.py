from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import Experiment

router = APIRouter(prefix="/experiments", tags=["experiments"])


class ExperimentCreate(BaseModel):
    name: str


class ExperimentOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


@router.post("", response_model=ExperimentOut)
def create_experiment(body: ExperimentCreate, db: Session = Depends(get_db)):
    exp = Experiment(name=body.name)
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return exp


@router.get("", response_model=list[ExperimentOut])
def list_experiments(db: Session = Depends(get_db)):
    return db.query(Experiment).order_by(Experiment.created_at.desc()).all()


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: int, db: Session = Depends(get_db)):
    exp = db.query(Experiment).filter(Experiment.id == experiment_id).first()
    if not exp:
        from app.exceptions import AnomalyError
        raise AnomalyError(404, "not_found", f"实验 id={experiment_id} 不存在", suggestion="检查实验编号是否正确")
    return exp
