from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services import formula_service

router = APIRouter(prefix="/formulas", tags=["formulas"])


class FormulaCreate(BaseModel):
    experiment_id: int
    name: str
    ingredients: dict[str, float]
    parent_id: Optional[int] = None


class FormulaOut(BaseModel):
    id: int
    experiment_id: int
    version: int
    parent_id: Optional[int]
    name: str
    ingredients: dict[str, float]
    source: str

    class Config:
        from_attributes = True


@router.post("", response_model=FormulaOut)
def create_formula(body: FormulaCreate, db: Session = Depends(get_db)):
    return formula_service.create_formula(
        db, body.experiment_id, body.name, body.ingredients, body.parent_id
    )


@router.get("/experiment/{experiment_id}", response_model=list[FormulaOut])
def list_formulas(experiment_id: int, db: Session = Depends(get_db)):
    return formula_service.list_formulas(db, experiment_id)


@router.get("/{formula_id}/chain", response_model=list[FormulaOut])
def get_formula_chain(formula_id: int, db: Session = Depends(get_db)):
    return formula_service.get_formula_chain(db, formula_id)


class ForkBody(BaseModel):
    new_name: Optional[str] = None


@router.post("/{formula_id}/fork", response_model=FormulaOut)
def fork_formula(formula_id: int, body: ForkBody = None, db: Session = Depends(get_db)):
    new_name = body.new_name if body else None
    return formula_service.fork_formula(db, formula_id, new_name)
