from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FullScore, PartScore
from ..proofread import proofread_full_score
from ..schemas import (
    FullScoreCreate,
    FullScoreRead,
    PartScoreCreate,
    PartScoreRead,
    ProofreadResult,
)

router = APIRouter(prefix="/scores", tags=["scores"])


@router.post("/full", response_model=FullScoreRead, status_code=201)
def create_full_score(body: FullScoreCreate, db: Session = Depends(get_db)):
    row = FullScore(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/full", response_model=list[FullScoreRead])
def list_full_scores(db: Session = Depends(get_db)):
    return db.query(FullScore).order_by(FullScore.id.desc()).all()


@router.get("/full/{score_id}", response_model=FullScoreRead)
def get_full_score(score_id: int, db: Session = Depends(get_db)):
    row = db.query(FullScore).filter(FullScore.id == score_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"总谱 id={score_id} 不存在")
    return row


@router.post("/part", response_model=PartScoreRead, status_code=201)
def create_part_score(body: PartScoreCreate, db: Session = Depends(get_db)):
    full_score = (
        db.query(FullScore).filter(FullScore.id == body.full_score_id).first()
    )
    if full_score is None:
        raise HTTPException(
            status_code=400,
            detail=f"关联的总谱 id={body.full_score_id} 不存在，无法创建分谱",
        )
    row = PartScore(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/part", response_model=list[PartScoreRead])
def list_part_scores(full_score_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(PartScore)
    if full_score_id is not None:
        q = q.filter(PartScore.full_score_id == full_score_id)
    return q.order_by(PartScore.id.desc()).all()


@router.get("/part/{part_id}", response_model=PartScoreRead)
def get_part_score(part_id: int, db: Session = Depends(get_db)):
    row = db.query(PartScore).filter(PartScore.id == part_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail=f"分谱 id={part_id} 不存在")
    return row


@router.post("/full/{score_id}/proofread", response_model=ProofreadResult)
def run_proofread(score_id: int, db: Session = Depends(get_db)):
    try:
        records = proofread_full_score(db, score_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return ProofreadResult(
        full_score_id=score_id,
        total_issues=len(records),
        issues=records,
    )
