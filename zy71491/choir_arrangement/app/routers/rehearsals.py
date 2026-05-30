from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Rehearsal
from app.schemas import RehearsalCreate, RehearsalUpdate, Rehearsal as RehearsalSchema

router = APIRouter(prefix="/rehearsals", tags=["rehearsals"])


@router.get("/", response_model=List[RehearsalSchema])
def list_rehearsals(status: str = None, db: Session = Depends(get_db)):
    query = db.query(Rehearsal)
    if status:
        query = query.filter(Rehearsal.status == status)
    return query.order_by(Rehearsal.rehearsal_date.desc()).all()


@router.get("/{rehearsal_id}", response_model=RehearsalSchema)
def get_rehearsal(rehearsal_id: int, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")
    return rehearsal


@router.get("/date/{rehearsal_date}", response_model=RehearsalSchema)
def get_rehearsal_by_date(rehearsal_date: str, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(
        Rehearsal.rehearsal_date == rehearsal_date
    ).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练日期[{rehearsal_date}]不存在")
    return rehearsal


@router.post("/", response_model=RehearsalSchema)
def create_rehearsal(rehearsal: RehearsalCreate, db: Session = Depends(get_db)):
    existing = db.query(Rehearsal).filter(
        Rehearsal.rehearsal_date == rehearsal.rehearsal_date
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"排练日期[{rehearsal.rehearsal_date}]已存在"
        )

    db_rehearsal = Rehearsal(**rehearsal.dict())
    db.add(db_rehearsal)
    db.commit()
    db.refresh(db_rehearsal)
    return db_rehearsal


@router.patch("/{rehearsal_id}", response_model=RehearsalSchema)
def update_rehearsal(rehearsal_id: int, rehearsal_update: RehearsalUpdate,
                     db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")

    old_status = rehearsal.status
    update_data = rehearsal_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rehearsal, key, value)

    db.commit()
    db.refresh(rehearsal)

    if "status" in update_data and update_data["status"] != old_status:
        from app.business.history_tracker import HistoryTracker
        tracker = HistoryTracker(db)
        tracker.log_status_change(rehearsal_id, old_status, update_data["status"])

    return rehearsal


@router.delete("/{rehearsal_id}")
def delete_rehearsal(rehearsal_id: int, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")

    from app.models import Arrangement
    db.query(Arrangement).filter(Arrangement.rehearsal_id == rehearsal_id).delete()
    db.delete(rehearsal)
    db.commit()
    return {"success": True, "message": f"排练[{rehearsal.rehearsal_date}]及排表已删除"}


@router.get("/{rehearsal_id}/balance")
def check_rehearsal_balance(rehearsal_id: int, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")

    from app.business.voice_balance import VoiceBalanceChecker
    checker = VoiceBalanceChecker(db)
    return checker.check_balance(rehearsal.rehearsal_date, rehearsal.difficulty)


@router.get("/{rehearsal_id}/substitutes")
def get_substitute_recommendations(rehearsal_id: int, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")

    from app.business.substitute_recommender import SubstituteRecommender
    recommender = SubstituteRecommender(db)
    return recommender.get_recommendations(rehearsal.rehearsal_date)
