from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date

from app.database import get_db
from app.models import Work, DrynessStatus
from app.schemas import (
    WorkCreate,
    WorkUpdate,
    WorkResponse,
    WorkListResponse,
)

router = APIRouter(prefix="/works", tags=["作品管理"])


@router.post("", response_model=WorkResponse, status_code=status.HTTP_201_CREATED)
async def create_work(
    work_data: WorkCreate,
    db: AsyncSession = Depends(get_db)
):
    new_work = Work(**work_data.model_dump())
    db.add(new_work)
    await db.commit()
    await db.refresh(new_work)
    return new_work


@router.get("", response_model=WorkListResponse)
async def list_works(
    student_name: Optional[str] = Query(None, description="学员姓名筛选"),
    dryness_status: Optional[DrynessStatus] = Query(None, description="干燥状态筛选"),
    temperature_zone: Optional[str] = Query(None, description="温区筛选"),
    is_dry: Optional[bool] = Query(None, description="是否已干燥"),
    is_delayed: Optional[bool] = Query(None, description="是否已延期"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Work)
    
    if student_name:
        query = query.where(Work.student_name.ilike(f"%{student_name}%"))
    
    if dryness_status:
        query = query.where(Work.dryness_status == dryness_status)
    
    if temperature_zone:
        query = query.where(Work.temperature_zone == temperature_zone)
    
    if is_dry is not None:
        if is_dry:
            query = query.where(Work.dryness_status == DrynessStatus.DRY)
        else:
            query = query.where(Work.dryness_status != DrynessStatus.DRY)
    
    if is_delayed is not None:
        today = date.today()
        if is_delayed:
            query = query.where(Work.expected_pickup_date < today)
        else:
            query = query.where(Work.expected_pickup_date >= today)
    
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()
    
    offset = (page - 1) * page_size
    query = query.order_by(Work.created_at.desc()).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    works = result.scalars().all()
    
    return WorkListResponse(total=total, items=list(works))


@router.get("/{work_id}", response_model=WorkResponse)
async def get_work(
    work_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Work).where(Work.id == work_id))
    work = result.scalar_one_or_none()
    
    if not work:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"作品 ID {work_id} 不存在"
        )
    
    return work


@router.put("/{work_id}", response_model=WorkResponse)
async def update_work(
    work_id: int,
    work_data: WorkUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Work).where(Work.id == work_id))
    work = result.scalar_one_or_none()
    
    if not work:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"作品 ID {work_id} 不存在"
        )
    
    update_data = work_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(work, key, value)
    
    await db.commit()
    await db.refresh(work)
    return work


@router.delete("/{work_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work(
    work_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Work).where(Work.id == work_id))
    work = result.scalar_one_or_none()
    
    if not work:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"作品 ID {work_id} 不存在"
        )
    
    await db.delete(work)
    await db.commit()
