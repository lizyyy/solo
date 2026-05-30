from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubstitutePool, Member
from app.schemas import SubstitutePoolCreate, SubstitutePool as SubstitutePoolSchema

router = APIRouter(prefix="/substitutes", tags=["substitutes"])


@router.get("/", response_model=List[SubstitutePoolSchema])
def list_substitutes(voice_part: str = None, is_available: bool = None, db: Session = Depends(get_db)):
    query = db.query(SubstitutePool)
    if voice_part:
        query = query.filter(SubstitutePool.voice_part == voice_part)
    if is_available is not None:
        query = query.filter(SubstitutePool.is_available == is_available)
    return query.all()


@router.post("/", response_model=SubstitutePoolSchema)
def create_substitute(substitute: SubstitutePoolCreate, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == substitute.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{substitute.member_id}]不存在")

    existing = db.query(SubstitutePool).filter(
        SubstitutePool.member_id == substitute.member_id,
        SubstitutePool.voice_part == substitute.voice_part
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"成员[{member.name}]已在声部[{substitute.voice_part}]替补池中"
        )

    db_sub = SubstitutePool(**substitute.dict())
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub


@router.delete("/{substitute_id}")
def delete_substitute(substitute_id: int, db: Session = Depends(get_db)):
    substitute = db.query(SubstitutePool).filter(
        SubstitutePool.id == substitute_id
    ).first()
    if not substitute:
        raise HTTPException(status_code=404, detail=f"替补记录ID[{substitute_id}]不存在")

    db.delete(substitute)
    db.commit()
    return {"success": True, "message": "替补记录已删除"}


@router.patch("/{substitute_id}/availability")
def toggle_availability(substitute_id: int, is_available: bool, db: Session = Depends(get_db)):
    substitute = db.query(SubstitutePool).filter(
        SubstitutePool.id == substitute_id
    ).first()
    if not substitute:
        raise HTTPException(status_code=404, detail=f"替补记录ID[{substitute_id}]不存在")

    substitute.is_available = is_available
    db.commit()
    db.refresh(substitute)
    return substitute
