from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Stage
from app.schemas import StageCreate, StageRead, ErrorResponse

router = APIRouter(prefix="/stages", tags=["stages"])


@router.get("/", response_model=List[StageRead])
def list_stages(db: Session = Depends(get_db)):
    return db.query(Stage).order_by(Stage.id).all()


@router.get("/{stage_id}", response_model=StageRead, responses={404: {"model": ErrorResponse}})
def get_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(Stage).get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "舞台不存在", "detail": f"stage_id={stage_id}"})
    return stage


@router.post("/", response_model=StageRead, status_code=201)
def create_stage(data: StageCreate, db: Session = Depends(get_db)):
    stage = Stage(**data.model_dump())
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


@router.put("/{stage_id}", response_model=StageRead, responses={404: {"model": ErrorResponse}})
def update_stage(stage_id: int, data: StageCreate, db: Session = Depends(get_db)):
    stage = db.query(Stage).get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "舞台不存在", "detail": f"stage_id={stage_id}"})
    for k, v in data.model_dump().items():
        setattr(stage, k, v)
    db.commit()
    db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=204, responses={404: {"model": ErrorResponse}})
def delete_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = db.query(Stage).get(stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "舞台不存在", "detail": f"stage_id={stage_id}"})
    db.delete(stage)
    db.commit()
