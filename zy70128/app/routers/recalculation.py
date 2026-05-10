from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.recalculation_service import RecalculationService

router = APIRouter(prefix="/api/v1/recalculation", tags=["名次重算"])


@router.post("/ranks/{version_id}")
async def recalculate_ranks(
    version_id: int,
    method: str = Query("DURATION", description="重算方法: DURATION 或 END_TIME"),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """重排名次"""
    service = RecalculationService(db)
    result = await service.recalculate_ranks(
        version_id=version_id,
        recalculate_method=method,
        category=category,
    )

    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    await db.commit()
    return result


@router.post("/from-chip/{version_id}/{batch_id}")
async def recalculate_from_chip_data(
    version_id: int,
    batch_id: int,
    db: AsyncSession = Depends(get_db),
):
    """基于芯片数据重算成绩"""
    service = RecalculationService(db)
    result = await service.recalculate_from_chip_data(
        version_id=version_id,
        batch_id=batch_id,
    )

    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    await db.commit()
    return result


@router.post("/new-version/{race_id}/{review_id}")
async def create_recalculated_version(
    race_id: int,
    review_id: int,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """基于审核结果创建重算版本"""
    service = RecalculationService(db)
    result = await service.create_recalculated_version(
        race_id=race_id,
        review_id=review_id,
        notes=notes,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建重算版本失败，请确保审核已批准",
        )

    await db.commit()
    return result
