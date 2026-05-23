from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_reviewer, allow_supervisor
from app.models import User, CustomerComplaint, DataQuality
from app.schemas import CustomerComplaintCreate, CustomerComplaintUpdate, CustomerComplaint as CustomerComplaintSchema
from app.services import DataQualityService

router = APIRouter()


@router.post("/", response_model=CustomerComplaintSchema, dependencies=[Depends(allow_data_entry)])
def create_complaint(
    complaint: CustomerComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    is_valid, issues = DataQualityService.validate_complaint(db, complaint.model_dump())
    
    if not is_valid:
        DataQualityService.save_failed_data(
            db, "customer_complaint", complaint.model_dump(), "; ".join(issues)
        )
        raise HTTPException(status_code=400, detail=f"数据校验失败: {', '.join(issues)}")
    
    db_complaint = CustomerComplaint(
        **complaint.model_dump(),
        created_by=current_user.id,
        data_quality=DataQuality.VALID
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.get("/", response_model=list[CustomerComplaintSchema])
def list_complaints(
    skip: int = 0,
    limit: int = 100,
    pile_id: Optional[int] = None,
    complaint_type: Optional[str] = None,
    data_quality: Optional[DataQuality] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(CustomerComplaint)
    if pile_id:
        query = query.filter(CustomerComplaint.pile_id == pile_id)
    if complaint_type:
        query = query.filter(CustomerComplaint.complaint_type == complaint_type)
    if data_quality:
        query = query.filter(CustomerComplaint.data_quality == data_quality)
    
    complaints = query.order_by(CustomerComplaint.complaint_time.desc()).offset(skip).limit(limit).all()
    return complaints


@router.get("/{complaint_id}", response_model=CustomerComplaintSchema)
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    complaint = db.query(CustomerComplaint).filter(CustomerComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="投诉记录不存在")
    return complaint


@router.put("/{complaint_id}", response_model=CustomerComplaintSchema, dependencies=[Depends(allow_data_entry)])
def update_complaint(
    complaint_id: int,
    complaint_update: CustomerComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_complaint = db.query(CustomerComplaint).filter(CustomerComplaint.id == complaint_id).first()
    if not db_complaint:
        raise HTTPException(status_code=404, detail="投诉记录不存在")
    
    for field, value in complaint_update.model_dump(exclude_unset=True).items():
        setattr(db_complaint, field, value)
    
    db.commit()
    db.refresh(db_complaint)
    return db_complaint


@router.post("/{complaint_id}/review", dependencies=[Depends(allow_reviewer)])
def review_complaint(
    complaint_id: int,
    is_valid: bool,
    review_comment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_complaint = db.query(CustomerComplaint).filter(CustomerComplaint.id == complaint_id).first()
    if not db_complaint:
        raise HTTPException(status_code=404, detail="投诉记录不存在")
    
    db_complaint.data_quality = DataQuality.VALID if is_valid else DataQuality.INVALID
    db_complaint.quality_issue = review_comment
    db_complaint.reviewed_by = current_user.id
    
    db.commit()
    return {"success": True, "message": "复核完成", "data_quality": db_complaint.data_quality}


@router.delete("/{complaint_id}", dependencies=[Depends(allow_supervisor)])
def delete_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_complaint = db.query(CustomerComplaint).filter(CustomerComplaint.id == complaint_id).first()
    if not db_complaint:
        raise HTTPException(status_code=404, detail="投诉记录不存在")
    
    db.delete(db_complaint)
    db.commit()
    return {"success": True, "message": "删除成功"}
