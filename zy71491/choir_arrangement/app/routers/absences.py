from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Absence, Member
from app.schemas import AbsenceCreate, Absence as AbsenceSchema

router = APIRouter(prefix="/absences", tags=["absences"])


@router.get("/", response_model=List[AbsenceSchema])
def list_absences(rehearsal_date: str = None, member_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Absence)
    if rehearsal_date:
        query = query.filter(Absence.rehearsal_date == rehearsal_date)
    if member_id:
        query = query.filter(Absence.member_id == member_id)
    return query.all()


@router.post("/", response_model=AbsenceSchema)
def create_absence(absence: AbsenceCreate, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == absence.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{absence.member_id}]不存在")

    existing = db.query(Absence).filter(
        Absence.member_id == absence.member_id,
        Absence.rehearsal_date == absence.rehearsal_date
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"成员[{member.name}]在{absence.rehearsal_date}已有缺勤记录，请勿重复添加"
        )

    db_absence = Absence(**absence.dict())
    db.add(db_absence)
    db.commit()
    db.refresh(db_absence)
    return db_absence


@router.delete("/{absence_id}")
def delete_absence(absence_id: int, db: Session = Depends(get_db)):
    absence = db.query(Absence).filter(Absence.id == absence_id).first()
    if not absence:
        raise HTTPException(status_code=404, detail=f"缺勤记录ID[{absence_id}]不存在")

    db.delete(absence)
    db.commit()
    return {"success": True, "message": "缺勤记录已删除"}


@router.get("/summary/{rehearsal_date}")
def get_absence_summary(rehearsal_date: str, db: Session = Depends(get_db)):
    from app.business.absence_aggregator import AbsenceAggregator
    aggregator = AbsenceAggregator(db)
    return aggregator.aggregate_by_rehearsal(rehearsal_date)


@router.post("/bulk")
def bulk_create_absences(absences: List[AbsenceCreate], db: Session = Depends(get_db)):
    created = []
    errors = []

    for absence_data in absences:
        member = db.query(Member).filter(Member.id == absence_data.member_id).first()
        if not member:
            errors.append(f"成员ID[{absence_data.member_id}]不存在")
            continue

        existing = db.query(Absence).filter(
            Absence.member_id == absence_data.member_id,
            Absence.rehearsal_date == absence_data.rehearsal_date
        ).first()
        if existing:
            errors.append(f"成员[{member.name}]在{absence_data.rehearsal_date}已有缺勤记录")
            continue

        db_absence = Absence(**absence_data.dict())
        db.add(db_absence)
        db.flush()
        created.append(db_absence)

    db.commit()

    result = {
        "success": len(errors) == 0,
        "created_count": len(created),
        "errors": errors
    }
    if created:
        result["created"] = created
    return result
