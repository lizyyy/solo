from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.chip import ChipBatchCreate, ChipBatchResponse, ChipImportRequest
from app.services.chip_service import ChipService

router = APIRouter(prefix="/api/v1/chips", tags=["芯片数据管理"])


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_chip_data(import_data: ChipImportRequest, db: AsyncSession = Depends(get_db)):
    """导入芯片数据"""
    service = ChipService(db)
    batch, errors = await service.import_chip_data(import_data)
    await db.commit()

    full_batch = await service.get_batch(batch.id, include_chip_data=True)
    return {
        "batch_id": full_batch.id,
        "total_records": full_batch.total_records,
        "processed_records": full_batch.processed_records,
        "error_count": full_batch.error_count,
        "import_status": full_batch.import_status,
        "has_errors": full_batch.error_count > 0,
    }


@router.post("/batches", response_model=ChipBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_batch(batch_data: ChipBatchCreate, db: AsyncSession = Depends(get_db)):
    """创建芯片数据批次"""
    service = ChipService(db)
    batch = await service.create_batch(batch_data)
    await db.commit()
    return batch


@router.get("/batches", response_model=List[ChipBatchResponse])
async def list_batches(
    race_id: Optional[int] = None,
    import_status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出芯片数据批次"""
    service = ChipService(db)
    batches = await service.list_batches(
        race_id=race_id,
        import_status=import_status,
        limit=limit,
        offset=offset,
    )
    return batches


@router.get("/batches/{batch_id}", response_model=ChipBatchResponse)
async def get_batch(batch_id: int, db: AsyncSession = Depends(get_db)):
    """获取芯片数据批次"""
    service = ChipService(db)
    batch = await service.get_batch(batch_id, include_chip_data=True)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="批次不存在")
    return batch


@router.post("/batches/{batch_id}/reconcile/{version_id}")
async def reconcile_with_results(
    batch_id: int,
    version_id: int,
    db: AsyncSession = Depends(get_db),
):
    """对比芯片数据与成绩数据"""
    service = ChipService(db)
    result = await service.reconcile_with_results(batch_id, version_id)

    if "error" in result:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    await db.commit()
    return result
