from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.models.models import User, InspectionResult
from app.schemas.schemas import InspectionRecordCreate, InspectionRecordResponse, ApiResponse, PaginatedResponse
from app.services.inspection_service import InspectionService
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def list_inspections(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    pump_room_id: Optional[int] = None,
    result: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result_enum = None
    if result:
        try:
            result_enum = InspectionResult(result)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的巡检结果")
    
    records = InspectionService.get_inspection_records(
        db, skip=skip, limit=limit,
        pump_room_id=pump_room_id, result=result_enum,
        start_date=start_date, end_date=end_date
    )
    total = InspectionService.count_inspection_records(
        db, pump_room_id=pump_room_id, result=result_enum,
        start_date=start_date, end_date=end_date
    )
    return PaginatedResponse(
        code=200,
        message="success",
        data=[InspectionRecordResponse.model_validate(r) for r in records],
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )


@router.get("/{record_id}", response_model=ApiResponse)
def get_inspection(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = InspectionService.get_inspection_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    return ApiResponse(code=200, message="success", data=InspectionRecordResponse.model_validate(record))


@router.post("", response_model=ApiResponse)
def create_inspection(
    record_in: InspectionRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        record = InspectionService.create_inspection_record(db, record_in, current_user.id)
        return ApiResponse(code=201, message="创建成功", data=InspectionRecordResponse.model_validate(record))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
