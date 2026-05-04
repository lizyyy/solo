from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models import Policy, Coverage
from app.schemas import PolicyCreate, PolicyUpdate, PolicyResponse

router = APIRouter()


@router.get("/", response_model=List[PolicyResponse])
async def list_policies(
    member_id: Optional[int] = Query(None),
    policy_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Policy).options(selectinload(Policy.coverages)).order_by(Policy.id)
    
    conditions = []
    if member_id is not None:
        conditions.append(Policy.insured_member_id == member_id)
    if policy_type:
        conditions.append(Policy.policy_type == policy_type)
    if is_active is not None:
        conditions.append(Policy.is_active == is_active)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    result = await db.execute(query)
    policies = result.scalars().all()
    return policies


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Policy).options(selectinload(Policy.coverages)).where(Policy.id == policy_id)
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.post("/", response_model=PolicyResponse, status_code=201)
async def create_policy(policy: PolicyCreate, db: AsyncSession = Depends(get_db)):
    db_policy = Policy(**policy.model_dump())
    db.add(db_policy)
    await db.commit()
    await db.refresh(db_policy)
    return db_policy


@router.put("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: int, 
    policy: PolicyUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Policy).where(Policy.id == policy_id))
    db_policy = result.scalar_one_or_none()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    update_data = policy.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_policy, key, value)
    
    await db.commit()
    await db.refresh(db_policy)
    return db_policy


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(policy_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Policy).where(Policy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    await db.delete(policy)
    await db.commit()
