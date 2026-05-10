from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas import InsurancePolicyCreate, InsurancePolicyUpdate, InsurancePolicy as InsuranceSchema
from app.services.insurance_service import insurance_service

router = APIRouter(prefix="/api/v1/insurance", tags=["保险单管理"])


@router.post("", response_model=InsuranceSchema)
def create_insurance(
    data: InsurancePolicyCreate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return insurance_service.create_insurance(db, data.model_dump(), operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[InsuranceSchema])
def list_insurance(
    skip: int = 0,
    limit: int = 100,
    approval_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import InsurancePolicy
    query = db.query(InsurancePolicy)
    
    if approval_id:
        query = query.filter(InsurancePolicy.approval_id == approval_id)
    if status:
        query = query.filter(InsurancePolicy.status == status)
    
    return query.order_by(InsurancePolicy.id.desc()).offset(skip).limit(limit).all()


@router.get("/{insurance_id}", response_model=InsuranceSchema)
def get_insurance(insurance_id: int, db: Session = Depends(get_db)):
    insurance = insurance_service.get(db, insurance_id)
    if not insurance:
        raise HTTPException(status_code=404, detail=f"保险单 {insurance_id} 不存在")
    return insurance


@router.patch("/{insurance_id}", response_model=InsuranceSchema)
def update_insurance(
    insurance_id: int,
    data: InsurancePolicyUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    insurance = insurance_service.get(db, insurance_id)
    if not insurance:
        raise HTTPException(status_code=404, detail=f"保险单 {insurance_id} 不存在")
    
    if insurance.status != 'draft':
        raise HTTPException(status_code=400, detail="只有草稿状态的保险单才能修改")
    
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return insurance
    
    return insurance_service.update(db, insurance, update_data)


@router.post("/{insurance_id}/issue", response_model=InsuranceSchema)
def issue_insurance(
    insurance_id: int,
    operator: str = Query(..., description="操作人"),
    policy_document_url: Optional[str] = Query(None, description="保险单文档URL"),
    db: Session = Depends(get_db)
):
    try:
        return insurance_service.issue_insurance(db, insurance_id, operator, policy_document_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{insurance_id}/cancel", response_model=InsuranceSchema)
def cancel_insurance(
    insurance_id: int,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="取消原因"),
    db: Session = Depends(get_db)
):
    try:
        return insurance_service.cancel_insurance(db, insurance_id, operator, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/approval/{approval_id}", response_model=InsuranceSchema)
def get_insurance_by_approval(approval_id: int, db: Session = Depends(get_db)):
    insurance = insurance_service.get_by_approval(db, approval_id)
    if not insurance:
        raise HTTPException(status_code=404, detail=f"审批申请 {approval_id} 没有保险单")
    return insurance
