from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_reviewer, allow_supervisor
from app.models import User, Inspection, DataQuality, InspectionStatus
from app.schemas import InspectionCreate, InspectionUpdate, Inspection as InspectionSchema
from app.services import DataQualityService

router = APIRouter()


@router.post("/", response_model=InspectionSchema, dependencies=[Depends(allow_data_entry)])
def create_inspection(
    inspection: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    is_valid, issues = DataQualityService.validate_inspection(db, inspection.model_dump())
    
    if not is_valid:
        DataQualityService.save_failed_data(
            db, "inspection", inspection.model_dump(), "; ".join(issues)
        )
        raise HTTPException(status_code=400, detail=f"数据校验失败: {', '.join(issues)}")
    
    db_inspection = Inspection(
        **inspection.model_dump(),
        created_by=current_user.id,
        data_quality=DataQuality.VALID
    )
    db.add(db_inspection)
    db.commit()
    db.refresh(db_inspection)
    return db_inspection


@router.get("/", response_model=list[InspectionSchema])
def list_inspections(
    skip: int = 0,
    limit: int = 100,
    pile_id: Optional[int] = None,
    status: Optional[InspectionStatus] = None,
    data_quality: Optional[DataQuality] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(Inspection)
    if pile_id:
        query = query.filter(Inspection.pile_id == pile_id)
    if status:
        query = query.filter(Inspection.status == status)
    if data_quality:
        query = query.filter(Inspection.data_quality == data_quality)
    
    inspections = query.order_by(Inspection.inspection_date.desc()).offset(skip).limit(limit).all()
    return inspections


@router.get("/{inspection_id}", response_model=InspectionSchema)
def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    return inspection


@router.put("/{inspection_id}", response_model=InspectionSchema, dependencies=[Depends(allow_data_entry)])
def update_inspection(
    inspection_id: int,
    inspection_update: InspectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not db_inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    for field, value in inspection_update.model_dump(exclude_unset=True).items():
        setattr(db_inspection, field, value)
    
    db.commit()
    db.refresh(db_inspection)
    return db_inspection


@router.post("/{inspection_id}/review", dependencies=[Depends(allow_reviewer)])
def review_inspection(
    inspection_id: int,
    is_valid: bool,
    review_comment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not db_inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    db_inspection.data_quality = DataQuality.VALID if is_valid else DataQuality.INVALID
    db_inspection.quality_issue = review_comment
    db_inspection.reviewed_by = current_user.id
    
    db.commit()
    return {"success": True, "message": "复核完成", "data_quality": db_inspection.data_quality}


@router.delete("/{inspection_id}", dependencies=[Depends(allow_supervisor)])
def delete_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_inspection = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not db_inspection:
        raise HTTPException(status_code=404, detail="巡检记录不存在")
    
    db.delete(db_inspection)
    db.commit()
    return {"success": True, "message": "删除成功"}
