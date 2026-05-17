from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import DeductionRatio as DeductionModel, Category as CategoryModel
from schemas import DeductionRatio, DeductionRatioCreate, APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse)
def create_deduction(deduction: DeductionRatioCreate, db: Session = Depends(get_db)):
    category = db.query(CategoryModel).filter(CategoryModel.id == deduction.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="品类不存在")
    
    db.query(DeductionModel).filter(
        DeductionModel.category_id == deduction.category_id,
        DeductionModel.is_active == True
    ).update({"is_active": False})
    
    max_version = db.query(DeductionModel).filter(
        DeductionModel.category_id == deduction.category_id
    ).count()
    
    db_deduction = DeductionModel(
        **deduction.model_dump(),
        version=max_version + 1,
        is_active=True
    )
    db.add(db_deduction)
    db.commit()
    db.refresh(db_deduction)
    return APIResponse(success=True, message="扣杂比例创建成功", data={"deduction": DeductionRatio.model_validate(db_deduction).model_dump()})


@router.get("/", response_model=List[DeductionRatio])
def list_deductions(category_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(DeductionModel)
    if category_id:
        query = query.filter(DeductionModel.category_id == category_id)
    deductions = query.order_by(DeductionModel.version.desc()).offset(skip).limit(limit).all()
    return deductions


@router.get("/{deduction_id}", response_model=DeductionRatio)
def get_deduction(deduction_id: int, db: Session = Depends(get_db)):
    deduction = db.query(DeductionModel).filter(DeductionModel.id == deduction_id).first()
    if not deduction:
        raise HTTPException(status_code=404, detail="扣杂比例不存在")
    return deduction


@router.get("/category/{category_id}/active", response_model=DeductionRatio)
def get_active_deduction(category_id: int, db: Session = Depends(get_db)):
    deduction = db.query(DeductionModel).filter(
        DeductionModel.category_id == category_id,
        DeductionModel.is_active == True
    ).first()
    if not deduction:
        raise HTTPException(status_code=404, detail="该品类无有效扣杂比例")
    return deduction
