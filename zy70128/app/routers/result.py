from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.result import ResultVersionCreate, ResultVersionResponse
from app.services.result_service import ResultService

router = APIRouter(prefix="/api/v1/results", tags=["成绩版本管理"])


@router.post("/versions", response_model=ResultVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(version_data: ResultVersionCreate, db: AsyncSession = Depends(get_db)):
    """创建成绩版本"""
    service = ResultService(db)
    version = await service.create_version(version_data)
    if not version:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="创建版本失败")
    await db.commit()

    full_version = await service.get_version(version.id, include_records=True)
    return full_version


@router.get("/versions", response_model=List[ResultVersionResponse])
async def list_versions(
    race_id: Optional[int] = None,
    is_latest: Optional[bool] = None,
    is_public: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出成绩版本"""
    service = ResultService(db)
    versions = await service.list_versions(
        race_id=race_id,
        is_latest=is_latest,
        is_public=is_public,
        limit=limit,
        offset=offset,
    )
    return versions


@router.get("/versions/{version_id}", response_model=ResultVersionResponse)
async def get_version(version_id: int, db: AsyncSession = Depends(get_db)):
    """获取成绩版本"""
    service = ResultService(db)
    version = await service.get_version(version_id, include_records=True)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    return version


@router.get("/races/{race_id}/latest", response_model=ResultVersionResponse)
async def get_latest_version(race_id: int, db: AsyncSession = Depends(get_db)):
    """获取赛事最新版本"""
    service = ResultService(db)
    version = await service.get_latest_version(race_id, include_records=True)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到成绩版本")
    return version


@router.post("/versions/{version_id}/publish", response_model=ResultVersionResponse)
async def publish_version(version_id: int, db: AsyncSession = Depends(get_db)):
    """发布成绩版本"""
    service = ResultService(db)
    version = await service.publish_version(version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="版本不存在")
    await db.commit()

    full_version = await service.get_version(version.id, include_records=True)
    return full_version


@router.post("/races/{race_id}/new-version", response_model=ResultVersionResponse)
async def create_new_version_from_previous(
    race_id: int,
    notes: Optional[str] = None,
    created_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """基于最新版本创建新版本"""
    service = ResultService(db)
    version = await service.create_new_version_from_previous(
        race_id=race_id,
        notes=notes,
        created_by=created_by,
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到现有版本")
    await db.commit()

    full_version = await service.get_version(version.id, include_records=True)
    return full_version


@router.post("/versions/{version_id}/validate")
async def validate_version(version_id: int, db: AsyncSession = Depends(get_db)):
    """验证版本一致性"""
    service = ResultService(db)
    result = await service.validate_version_consistency(version_id)
    if "error" in result and not result.get("valid", True):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)
    await db.commit()
    return result
