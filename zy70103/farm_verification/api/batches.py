from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.batch import (
    ImageBatchCreate, ImageBatchUpdate, ImageBatchResponse,
    BatchListResponse, BatchStatusEnum
)
from ..schemas.common import StandardResponse, BusinessErrorResponse
from ..services.batch_service import batch_service
from ..models.batch import BatchStatus


router = APIRouter(prefix="/api/batches", tags=["影像批次管理"])


@router.post("", response_model=StandardResponse[ImageBatchResponse])
def create_batch(batch_data: ImageBatchCreate, db: Session = Depends(get_db)):
    try:
        batch = batch_service.create_batch(db, batch_data)
        return StandardResponse(
            success=True,
            code=200,
            message=f"批次【{batch.batch_name}】创建成功",
            data=batch
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/{batch_code}", response_model=StandardResponse[ImageBatchResponse])
def get_batch(batch_code: str, db: Session = Depends(get_db)):
    batch = batch_service.get_batch_by_code(db, batch_code)
    if not batch:
        raise HTTPException(
            status_code=404,
            detail=f"批次【{batch_code}】不存在"
        )
    
    stats = batch_service.get_batch_statistics(db, batch_code)
    response = ImageBatchResponse.model_validate(batch)
    response.lesion_count = stats["statistics"]["total_lesion_count"]
    response.confirmed_lesion_count = stats["statistics"]["confirmed_count"]
    response.false_positive_count = stats["statistics"]["false_positive_count"]
    response.pending_count = stats["statistics"]["pending_count"]
    
    return StandardResponse(
        success=True,
        code=200,
        message=stats["business_message"],
        data=response
    )


@router.get("", response_model=StandardResponse[BatchListResponse])
def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[BatchStatusEnum] = Query(None),
    flight_area: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    result = batch_service.list_batches(
        db=db,
        page=page,
        page_size=page_size,
        status=BatchStatus(status.value) if status else None,
        flight_area=flight_area,
        keyword=keyword
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{result.total}个批次",
        data=result
    )


@router.put("/{batch_code}", response_model=StandardResponse[ImageBatchResponse])
def update_batch(
    batch_code: str, 
    update_data: ImageBatchUpdate, 
    db: Session = Depends(get_db)
):
    batch = batch_service.update_batch(db, batch_code, update_data)
    if not batch:
        raise HTTPException(
            status_code=404,
            detail=f"批次【{batch_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"批次【{batch.batch_name}】更新成功",
        data=batch
    )


@router.delete("/{batch_code}", response_model=StandardResponse[dict])
def delete_batch(batch_code: str, db: Session = Depends(get_db)):
    success = batch_service.delete_batch(db, batch_code)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"批次【{batch_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"批次【{batch_code}】删除成功"
    )


@router.get("/{batch_code}/statistics", response_model=StandardResponse[dict])
def get_batch_statistics(batch_code: str, db: Session = Depends(get_db)):
    try:
        stats = batch_service.get_batch_statistics(db, batch_code)
        return StandardResponse(
            success=True,
            code=200,
            message=stats["business_message"],
            data=stats
        )
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
