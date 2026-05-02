from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SubstitutionRequest, Child, MenuItem, SubstitutionStatus
from ..schemas import (
    SubstitutionRequestCreate, SubstitutionRequestUpdate, SubstitutionRequestResponse
)
from ..services import SubstitutionService

router = APIRouter(prefix="/substitutions", tags=["替餐申请"])


@router.get("/", response_model=List[SubstitutionRequestResponse])
def list_substitutions(
    status: Optional[SubstitutionStatus] = None,
    child_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SubstitutionRequest)
    if status:
        query = query.filter(SubstitutionRequest.status == status)
    if child_id:
        query = query.filter(SubstitutionRequest.child_id == child_id)
    return query.order_by(SubstitutionRequest.created_at.desc()).all()


@router.get("/{request_id}", response_model=SubstitutionRequestResponse)
def get_substitution(request_id: int, db: Session = Depends(get_db)):
    request = db.query(SubstitutionRequest).filter(SubstitutionRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="替餐申请不存在")
    return request


@router.post("/", response_model=SubstitutionRequestResponse)
def create_substitution(
    request: SubstitutionRequestCreate,
    db: Session = Depends(get_db)
):
    child = db.query(Child).filter(Child.id == request.child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="儿童档案不存在")
    
    if request.menu_item_id:
        menu_item = db.query(MenuItem).filter(MenuItem.id == request.menu_item_id).first()
        if not menu_item:
            raise HTTPException(status_code=404, detail="菜单项目不存在")
    
    db_request = SubstitutionRequest(**request.model_dump())
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    return db_request


@router.put("/{request_id}", response_model=SubstitutionRequestResponse)
def update_substitution(
    request_id: int,
    request_update: SubstitutionRequestUpdate,
    db: Session = Depends(get_db)
):
    request = db.query(SubstitutionRequest).filter(SubstitutionRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="替餐申请不存在")
    
    update_data = request_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(request, key, value)
    
    db.commit()
    db.refresh(request)
    
    return request


@router.post("/{request_id}/approve")
def approve_substitution(
    request_id: int,
    approver: str,
    approval_notes: Optional[str] = None,
    substitution_dish: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = SubstitutionService.approve_substitution(
        db=db,
        request_id=request_id,
        approver=approver,
        approval_notes=approval_notes,
        substitution_dish=substitution_dish
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/{request_id}/reject")
def reject_substitution(
    request_id: int,
    approver: str,
    rejection_reason: str,
    db: Session = Depends(get_db)
):
    result = SubstitutionService.reject_substitution(
        db=db,
        request_id=request_id,
        approver=approver,
        rejection_reason=rejection_reason
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.post("/{request_id}/implement")
def implement_substitution(
    request_id: int,
    operator: str,
    db: Session = Depends(get_db)
):
    result = SubstitutionService.implement_substitution(
        db=db,
        request_id=request_id,
        operator=operator
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.delete("/{request_id}")
def delete_substitution(request_id: int, db: Session = Depends(get_db)):
    request = db.query(SubstitutionRequest).filter(SubstitutionRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="替餐申请不存在")
    
    db.delete(request)
    db.commit()
    
    return {"success": True, "message": "替餐申请已删除"}
