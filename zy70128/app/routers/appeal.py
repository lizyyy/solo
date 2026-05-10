from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.appeal import AppealCreate, AppealUpdate, AppealResponse, AppealStatusUpdate
from app.services.appeal_service import AppealService

router = APIRouter(prefix="/api/v1/appeals", tags=["申诉管理"])


@router.post("/", response_model=AppealResponse, status_code=status.HTTP_201_CREATED)
async def create_appeal(appeal_data: AppealCreate, db: AsyncSession = Depends(get_db)):
    """创建申诉"""
    service = AppealService(db)
    appeal = await service.create_appeal(appeal_data)
    await db.commit()
    return appeal


@router.get("/", response_model=List[AppealResponse])
async def list_appeals(
    race_id: Optional[int] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出申诉"""
    service = AppealService(db)
    appeals = await service.list_appeals(
        race_id=race_id,
        status=status,
        priority=priority,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset,
    )
    return appeals


@router.get("/{appeal_id}", response_model=AppealResponse)
async def get_appeal(appeal_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个申诉"""
    service = AppealService(db)
    appeal = await service.get_appeal(appeal_id)
    if not appeal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申诉不存在")
    return appeal


@router.put("/{appeal_id}", response_model=AppealResponse)
async def update_appeal(
    appeal_id: int,
    update_data: AppealUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新申诉"""
    service = AppealService(db)
    appeal = await service.update_appeal(appeal_id, update_data)
    if not appeal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申诉不存在")
    await db.commit()
    return appeal


@router.post("/{appeal_id}/status", response_model=AppealResponse)
async def update_status(
    appeal_id: int,
    status_update: AppealStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新申诉状态"""
    service = AppealService(db)
    appeal = await service.update_status(appeal_id, status_update)
    if not appeal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申诉不存在")
    await db.commit()
    return appeal


@router.post("/{appeal_id}/assign", response_model=AppealResponse)
async def assign_appeal(
    appeal_id: int,
    assigned_to: str,
    db: AsyncSession = Depends(get_db),
):
    """分配申诉"""
    service = AppealService(db)
    appeal = await service.assign_appeal(appeal_id, assigned_to)
    if not appeal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申诉不存在")
    await db.commit()
    return appeal


@router.get("/races/{race_id}/stats")
async def get_appeal_stats(race_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """获取申诉统计"""
    service = AppealService(db)
    stats = await service.count_appeals_by_status(race_id=race_id)
    return {"race_id": race_id, "status_counts": stats}


@router.get("/pending", response_model=List[AppealResponse])
async def get_pending_appeals(
    race_id: Optional[int] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """获取待处理申诉"""
    service = AppealService(db)
    appeals = await service.get_pending_appeals(race_id=race_id, limit=limit)
    return appeals
