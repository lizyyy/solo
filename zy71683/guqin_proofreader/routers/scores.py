from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Score, ScoreVersion, VersionStatus
from schemas import ScoreCreate, ScoreOut, ScoreVersionCreate, ScoreVersionOut
from audit import log_audit

router = APIRouter(prefix="/scores", tags=["谱稿管理"])


@router.post("", response_model=ScoreOut)
def create_score(data: ScoreCreate, db: Session = Depends(get_db)):
    score = Score(
        title=data.title,
        composer=data.composer,
        tuning=data.tuning,
        mode=data.mode,
    )
    db.add(score)
    db.flush()
    log_audit(db, "create", "score", entity_id=score.id, after={
        "title": score.title, "composer": score.composer,
        "tuning": score.tuning, "mode": score.mode,
    })
    db.commit()
    db.refresh(score)
    return score


@router.get("", response_model=List[ScoreOut])
def list_scores(db: Session = Depends(get_db)):
    return db.query(Score).order_by(Score.created_at.desc()).all()


@router.get("/{score_id}", response_model=ScoreOut)
def get_score(score_id: int, db: Session = Depends(get_db)):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(404, "谱稿不存在")
    return score


@router.post("/{score_id}/versions", response_model=ScoreVersionOut)
def create_version(score_id: int, data: ScoreVersionCreate, db: Session = Depends(get_db)):
    score = db.query(Score).filter(Score.id == score_id).first()
    if not score:
        raise HTTPException(404, "谱稿不存在")

    max_ver = db.query(ScoreVersion).filter(
        ScoreVersion.score_id == score_id
    ).order_by(ScoreVersion.version_number.desc()).first()

    new_number = (max_ver.version_number + 1) if max_ver else 1

    version = ScoreVersion(
        score_id=score_id,
        version_number=new_number,
        content_json=data.content_json,
        status=VersionStatus.draft,
        change_note=data.change_note,
    )
    db.add(version)
    db.flush()

    log_audit(db, "create", "score_version", entity_id=version.id, after={
        "score_id": score_id, "version_number": new_number,
        "change_note": data.change_note,
    })
    db.commit()
    db.refresh(version)
    return version


@router.get("/{score_id}/versions", response_model=List[ScoreVersionOut])
def list_versions(score_id: int, db: Session = Depends(get_db)):
    return db.query(ScoreVersion).filter(
        ScoreVersion.score_id == score_id
    ).order_by(ScoreVersion.version_number).all()


@router.get("/versions/{version_id}", response_model=ScoreVersionOut)
def get_version(version_id: int, db: Session = Depends(get_db)):
    ver = db.query(ScoreVersion).filter(ScoreVersion.id == version_id).first()
    if not ver:
        raise HTTPException(404, "版本不存在")
    return ver
