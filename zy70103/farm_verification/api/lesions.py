from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from ..database import get_db
from ..schemas.lesion import (
    LesionRecordCreate, LesionRecordUpdate, LesionRecordResponse,
    LesionListResponse, LesionStatusEnum, LesionSourceEnum
)
from ..schemas.common import StandardResponse
from ..services.lesion_service import lesion_service
from ..models.lesion import LesionStatus, LesionSource


router = APIRouter(prefix="/api/lesions", tags=["病斑记录管理"])


@router.post("", response_model=StandardResponse[LesionRecordResponse])
def create_lesion(
    lesion_data: LesionRecordCreate,
    auto_match_grid: bool = Query(True, description="是否自动匹配地块"),
    db: Session = Depends(get_db)
):
    try:
        lesion = lesion_service.create_lesion(
            db=db,
            lesion_data=lesion_data,
            auto_match_grid=auto_match_grid
        )
        
        message = f"病斑【{lesion.lesion_code}】创建成功"
        if lesion.grid_code:
            message += f"，已自动匹配到地块【{lesion.grid_code} - {lesion.grid_name}】"
        else:
            message += "，但未匹配到地块，请手动关联"
        
        return StandardResponse(
            success=True,
            code=200,
            message=message,
            data=lesion
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/{lesion_code}", response_model=StandardResponse[dict])
def get_lesion_detail(lesion_code: str, db: Session = Depends(get_db)):
    detail = lesion_service.get_lesion_detail(db, lesion_code)
    if not detail:
        raise HTTPException(
            status_code=404,
            detail=f"病斑【{lesion_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=detail["business_summary"],
        data=detail
    )


@router.get("", response_model=StandardResponse[LesionListResponse])
def list_lesions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    batch_code: Optional[str] = Query(None),
    grid_code: Optional[str] = Query(None),
    status: Optional[LesionStatusEnum] = Query(None),
    source: Optional[LesionSourceEnum] = Query(None),
    lesion_type: Optional[str] = Query(None),
    is_false_positive: Optional[bool] = Query(None),
    is_reverted: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    result = lesion_service.list_lesions(
        db=db,
        page=page,
        page_size=page_size,
        batch_code=batch_code,
        grid_code=grid_code,
        status=LesionStatus(status.value) if status else None,
        source=LesionSource(source.value) if source else None,
        lesion_type=lesion_type,
        is_false_positive=is_false_positive,
        is_reverted=is_reverted
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{result.total}条病斑记录",
        data=result
    )


@router.put("/{lesion_code}", response_model=StandardResponse[LesionRecordResponse])
def update_lesion(
    lesion_code: str,
    update_data: LesionRecordUpdate,
    db: Session = Depends(get_db)
):
    lesion = lesion_service.update_lesion(db, lesion_code, update_data)
    if not lesion:
        raise HTTPException(
            status_code=404,
            detail=f"病斑【{lesion_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"病斑【{lesion_code}】更新成功",
        data=lesion
    )


@router.delete("/{lesion_code}", response_model=StandardResponse[dict])
def delete_lesion(lesion_code: str, db: Session = Depends(get_db)):
    success = lesion_service.delete_lesion(db, lesion_code)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"病斑【{lesion_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"病斑【{lesion_code}】删除成功"
    )
