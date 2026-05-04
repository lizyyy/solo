from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models import Coverage
from app.schemas import CoverageCreate, CoverageUpdate, CoverageResponse

router = APIRouter()


@router.get("/", response_model=List[CoverageResponse])
async def list_coverages(policy_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(Coverage).order_by(Coverage.id)
    if policy_id:
        query = query.where(Coverage.policy_id == policy_id)
    result = await db.execute(query)
    coverages = result.scalars().all()
    return coverages


@router.get("/{coverage_id}", response_model=CoverageResponse)
async def get_coverage(coverage_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coverage).where(Coverage.id == coverage_id))
    coverage = result.scalar_one_or_none()
    if not coverage:
        raise HTTPException(status_code=404, detail="Coverage not found")
    return coverage


@router.post("/", response_model=CoverageResponse, status_code=201)
async def create_coverage(coverage: CoverageCreate, db: AsyncSession = Depends(get_db)):
    db_coverage = Coverage(**coverage.model_dump())
    db.add(db_coverage)
    await db.commit()
    await db.refresh(db_coverage)
    return db_coverage


@router.put("/{coverage_id}", response_model=CoverageResponse)
async def update_coverage(
    coverage_id: int, 
    coverage: CoverageUpdate, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Coverage).where(Coverage.id == coverage_id))
    db_coverage = result.scalar_one_or_none()
    if not db_coverage:
        raise HTTPException(status_code=404, detail="Coverage not found")
    
    update_data = coverage.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_coverage, key, value)
    
    await db.commit()
    await db.refresh(db_coverage)
    return db_coverage


@router.delete("/{coverage_id}", status_code=204)
async def delete_coverage(coverage_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coverage).where(Coverage.id == coverage_id))
    coverage = result.scalar_one_or_none()
    if not coverage:
        raise HTTPException(status_code=404, detail="Coverage not found")
    
    await db.delete(coverage)
    await db.commit()
