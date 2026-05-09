from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..database import get_db
from ..models import Score, ScoreStatus
from ..schemas import (
    ScoreCreate, ScoreBatchInput, ScoreUpdate,
    ScoreLockRequest, ScoreOut
)
from ..services import ScoreService

router = APIRouter(prefix="/scores", tags=["成绩管理"])


@router.post("/batch-import", response_model=List[ScoreOut])
def batch_import_scores(
    data: ScoreBatchInput,
    db: Session = Depends(get_db)
):
    try:
        scores_data = [
            {"student_id": s.student_id, "score_value": s.score_value}
            for s in data.scores
        ]
        results = ScoreService.batch_import_scores(
            db,
            exam_id=data.exam_id,
            scores_data=scores_data,
            batch_key=data.batch_key
        )
        db.commit()
        for score in results:
            db.refresh(score)
        return results
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/lock", response_model=Dict[str, int])
def lock_scores(
    data: ScoreLockRequest,
    db: Session = Depends(get_db)
):
    try:
        locked = ScoreService.lock_scores_by_exam(
            db,
            exam_id=data.exam_id,
            operator_id=data.operator_id
        )
        db.commit()
        return {"locked_count": locked}
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{score_id}/unlock", response_model=ScoreOut)
def unlock_score(
    score_id: int,
    operator_id: int,
    reason: str,
    db: Session = Depends(get_db)
):
    try:
        score = ScoreService.unlock_score(
            db,
            score_id=score_id,
            operator_id=operator_id,
            reason=reason
        )
        db.commit()
        db.refresh(score)
        return score
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{score_id}/rescore", response_model=ScoreOut)
def rescore(
    score_id: int,
    new_score: float,
    operator_id: int,
    reason: str,
    db: Session = Depends(get_db)
):
    try:
        score = ScoreService.rescore(
            db,
            score_id=score_id,
            new_score=new_score,
            operator_id=operator_id,
            reason=reason
        )
        db.commit()
        db.refresh(score)
        return score
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[ScoreOut])
def list_scores(
    exam_id: int = None,
    student_id: int = None,
    score_status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Score)
    if exam_id:
        query = query.filter(Score.exam_id == exam_id)
    if student_id:
        query = query.filter(Score.student_id == student_id)
    if score_status:
        query = query.filter(Score.score_status == score_status)
    return query.order_by(Score.created_at.desc()).all()


@router.get("/{score_id}", response_model=ScoreOut)
def get_score(
    score_id: int,
    db: Session = Depends(get_db)
):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(status_code=404, detail="成绩记录不存在")
    return score
