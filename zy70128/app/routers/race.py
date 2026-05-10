from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.race import RaceCreate, RaceUpdate, RaceResponse
from app.services.race_service import RaceService

router = APIRouter(prefix="/api/v1/races", tags=["赛事管理"])


@router.post("/", response_model=RaceResponse, status_code=status.HTTP_201_CREATED)
async def create_race(race_data: RaceCreate, db: AsyncSession = Depends(get_db)):
    """创建赛事"""
    service = RaceService(db)
    race = await service.create_race(race_data)
    await db.commit()
    return race


@router.get("/", response_model=List[RaceResponse])
async def list_races(
    is_published: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出赛事"""
    service = RaceService(db)
    races = await service.list_races(is_published=is_published, limit=limit, offset=offset)
    return races


@router.get("/{race_id}", response_model=RaceResponse)
async def get_race(race_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个赛事"""
    service = RaceService(db)
    race = await service.get_race(race_id)
    if not race:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="赛事不存在")
    return race


@router.put("/{race_id}", response_model=RaceResponse)
async def update_race(race_id: int, update_data: RaceUpdate, db: AsyncSession = Depends(get_db)):
    """更新赛事"""
    service = RaceService(db)
    race = await service.update_race(race_id, update_data)
    if not race:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="赛事不存在")
    await db.commit()
    return race


@router.delete("/{race_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_race(race_id: int, db: AsyncSession = Depends(get_db)):
    """删除赛事"""
    service = RaceService(db)
    success = await service.delete_race(race_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="赛事不存在")
    await db.commit()


@router.post("/{race_id}/publish", response_model=RaceResponse)
async def publish_race(race_id: int, db: AsyncSession = Depends(get_db)):
    """发布赛事"""
    service = RaceService(db)
    race = await service.publish_race(race_id)
    if not race:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="赛事不存在")
    await db.commit()
    return race


@router.post("/{race_id}/unpublish", response_model=RaceResponse)
async def unpublish_race(race_id: int, db: AsyncSession = Depends(get_db)):
    """取消发布赛事"""
    service = RaceService(db)
    race = await service.unpublish_race(race_id)
    if not race:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="赛事不存在")
    await db.commit()
    return race
