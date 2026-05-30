from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Member
from app.schemas import MemberCreate, MemberUpdate, Member as MemberSchema

router = APIRouter(prefix="/members", tags=["members"])


@router.get("/", response_model=List[MemberSchema])
def list_members(voice_part: str = None, is_active: bool = None, db: Session = Depends(get_db)):
    query = db.query(Member)
    if voice_part:
        query = query.filter(Member.voice_part == voice_part)
    if is_active is not None:
        query = query.filter(Member.is_active == is_active)
    return query.all()


@router.get("/{member_id}", response_model=MemberSchema)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{member_id}]不存在")
    return member


@router.post("/", response_model=MemberSchema)
def create_member(member: MemberCreate, db: Session = Depends(get_db)):
    db_member = Member(**member.dict())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@router.patch("/{member_id}", response_model=MemberSchema)
def update_member(member_id: int, member_update: MemberUpdate, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{member_id}]不存在")

    update_data = member_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(member, key, value)

    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{member_id}]不存在")

    member.is_active = False
    db.commit()
    return {"success": True, "message": f"成员[{member.name}]已停用"}


@router.post("/bulk")
def bulk_create_members(members: List[MemberCreate], db: Session = Depends(get_db)):
    created = []
    for member_data in members:
        db_member = Member(**member_data.dict())
        db.add(db_member)
        db.flush()
        created.append(db_member)
    db.commit()
    return {"success": True, "created_count": len(created), "members": created}
