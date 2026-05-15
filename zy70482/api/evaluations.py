from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import EvaluationResponse, ConfirmEvaluationRequest
from services import evaluate_material, confirm_evaluation
from models import Evaluation, Material

router = APIRouter()


@router.post("/", response_model=EvaluationResponse)
def create_evaluation(material_id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="材料不存在")
    
    try:
        evaluation = evaluate_material(material, db)
        return evaluation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
def get_evaluation(evaluation_id: int, db: Session = Depends(get_db)):
    evaluation = db.query(Evaluation).filter(Evaluation.id == evaluation_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="评估不存在")
    return evaluation


@router.get("/material/{material_id}", response_model=List[EvaluationResponse])
def get_material_evaluations(material_id: int, db: Session = Depends(get_db)):
    evaluations = db.query(Evaluation).filter(Evaluation.material_id == material_id).order_by(Evaluation.created_at.desc()).all()
    return evaluations


@router.post("/{evaluation_id}/confirm", response_model=EvaluationResponse)
def confirm_evaluation_endpoint(
    evaluation_id: int,
    request: ConfirmEvaluationRequest,
    db: Session = Depends(get_db)
):
    try:
        evaluation = confirm_evaluation(db, evaluation_id, request.operator, request.confirmed)
        return evaluation
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
