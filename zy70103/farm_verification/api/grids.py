from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.grid import (
    FarmGridCreate, FarmGridUpdate, FarmGridResponse,
    GridListResponse, CoordinateSearchResponse, GridStatusEnum
)
from ..schemas.common import StandardResponse
from ..services.grid_service import grid_service
from ..models.grid import GridStatus


router = APIRouter(prefix="/api/grids", tags=["地块网格管理"])


@router.post("", response_model=StandardResponse[FarmGridResponse])
def create_grid(grid_data: FarmGridCreate, db: Session = Depends(get_db)):
    try:
        grid = grid_service.create_grid(db, grid_data)
        return StandardResponse(
            success=True,
            code=200,
            message=f"地块【{grid.grid_name}】创建成功",
            data=grid
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/{grid_code}", response_model=StandardResponse[FarmGridResponse])
def get_grid(grid_code: str, db: Session = Depends(get_db)):
    grid = grid_service.get_grid_by_code(db, grid_code)
    if not grid:
        raise HTTPException(
            status_code=404,
            detail=f"地块【{grid_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"查找到地块【{grid.grid_name}】",
        data=grid
    )


@router.get("", response_model=StandardResponse[GridListResponse])
def list_grids(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[GridStatusEnum] = Query(None),
    region: Optional[str] = Query(None),
    crop_type: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    result = grid_service.list_grids(
        db=db,
        page=page,
        page_size=page_size,
        status=GridStatus(status.value) if status else None,
        region=region,
        crop_type=crop_type,
        keyword=keyword
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{result.total}个地块",
        data=result
    )


@router.put("/{grid_code}", response_model=StandardResponse[FarmGridResponse])
def update_grid(
    grid_code: str,
    update_data: FarmGridUpdate,
    db: Session = Depends(get_db)
):
    grid = grid_service.update_grid(db, grid_code, update_data)
    if not grid:
        raise HTTPException(
            status_code=404,
            detail=f"地块【{grid_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"地块【{grid.grid_name}】更新成功",
        data=grid
    )


@router.delete("/{grid_code}", response_model=StandardResponse[dict])
def delete_grid(grid_code: str, db: Session = Depends(get_db)):
    success = grid_service.delete_grid(db, grid_code)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"地块【{grid_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"地块【{grid_code}】删除成功"
    )


@router.get("/search/by-coordinate", response_model=StandardResponse[CoordinateSearchResponse])
def search_grid_by_coordinate(
    longitude: float = Query(..., description="经度"),
    latitude: float = Query(..., description="纬度"),
    max_search_radius_meters: float = Query(100.0, ge=1, description="最大搜索半径(米)"),
    db: Session = Depends(get_db)
):
    result = grid_service.find_grid_by_coordinate(
        db=db,
        longitude=longitude,
        latitude=latitude,
        max_search_radius_meters=max_search_radius_meters
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=result.message,
        data=result
    )


@router.post("/batch-match/{batch_code}", response_model=StandardResponse[dict])
def batch_match_lesions_to_grid(
    batch_code: str,
    db: Session = Depends(get_db)
):
    from ..services.batch_service import batch_service
    
    batch = batch_service.get_batch_by_code(db, batch_code)
    if not batch:
        raise HTTPException(
            status_code=404,
            detail=f"批次【{batch_code}】不存在"
        )
    
    result = grid_service.batch_match_lesions_to_grid(db, batch.id)
    
    return StandardResponse(
        success=True,
        code=200,
        message=result["message"],
        data=result
    )
