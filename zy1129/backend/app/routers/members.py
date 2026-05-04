from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models import Member
from app.schemas import MemberCreate, MemberUpdate, MemberResponse

router = APIRouter()


@router.get("/", response_model=List[MemberResponse])
async def list_members(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).order_by(Member.id))
    members = result.scalars().all()
    return members


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.post("/", response_model=MemberResponse, status_code=201)
async def create_member(member: MemberCreate, db: AsyncSession = Depends(get_db)):
    db_member = Member(**member.model_dump())
    db.add(db_member)
    await db.commit()
    await db.refresh(db_member)
    return db_member


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: int, 
    member: MemberUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Member).where(Member.id == member_id))
    db_member = result.scalar_one_or_none()
    if not db_member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_data = member.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_member, key, value)
    
    await db.commit()
    await db.refresh(db_member)
    return db_member


@router.delete("/{member_id}", status_code=204)
async def delete_member(member_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Member).where(Member.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    await db.delete(member)
    await db.commit()
