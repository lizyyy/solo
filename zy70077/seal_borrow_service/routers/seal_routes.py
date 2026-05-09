from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Seal, SealStatus, SealType
from ..schemas import (
    SealCreate, SealUpdate, SealResponse, BusinessResponse
)

router = APIRouter(prefix="/seals", tags=["印章管理"])


@router.post("", response_model=BusinessResponse, summary="新增印章")
def create_seal(seal_data: SealCreate, db: Session = Depends(get_db)):
    existing = db.query(Seal).filter(Seal.seal_code == seal_data.seal_code).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"印章编号「{seal_data.seal_code}」已存在"
        )
    
    seal = Seal(
        seal_code=seal_data.seal_code,
        seal_name=seal_data.seal_name,
        seal_type=seal_data.seal_type,
        description=seal_data.description,
        custodian=seal_data.custodian,
        department=seal_data.department,
        status=SealStatus.IN_STORAGE
    )
    db.add(seal)
    db.commit()
    db.refresh(seal)
    
    return BusinessResponse(
        success=True,
        business_code="SEAL_CREATED",
        message=f"印章「{seal.seal_name}」已添加成功，当前状态：在库",
        data={"seal_id": seal.id, "seal_code": seal.seal_code}
    )


@router.get("", response_model=List[SealResponse], summary="查询印章列表")
def list_seals(
    status: SealStatus = None,
    seal_type: SealType = None,
    db: Session = Depends(get_db)
):
    query = db.query(Seal).filter(Seal.is_active == True)
    
    if status:
        query = query.filter(Seal.status == status)
    if seal_type:
        query = query.filter(Seal.seal_type == seal_type)
    
    return query.order_by(Seal.created_at.desc()).all()


@router.get("/{seal_id}", response_model=SealResponse, summary="查询印章详情")
def get_seal(seal_id: int, db: Session = Depends(get_db)):
    seal = db.query(Seal).filter(Seal.id == seal_id).first()
    if not seal:
        raise HTTPException(status_code=404, detail="印章不存在")
    return seal


@router.put("/{seal_id}", response_model=BusinessResponse, summary="更新印章信息")
def update_seal(
    seal_id: int,
    seal_data: SealUpdate,
    db: Session = Depends(get_db)
):
    seal = db.query(Seal).filter(Seal.id == seal_id).first()
    if not seal:
        raise HTTPException(status_code=404, detail="印章不存在")
    
    update_fields = []
    if seal_data.seal_name:
        seal.seal_name = seal_data.seal_name
        update_fields.append("印章名称")
    if seal_data.seal_type:
        seal.seal_type = seal_data.seal_type
        update_fields.append("印章类型")
    if seal_data.description:
        seal.description = seal_data.description
        update_fields.append("描述")
    if seal_data.status:
        seal.status = seal_data.status
        update_fields.append("状态")
    if seal_data.custodian:
        seal.custodian = seal_data.custodian
        update_fields.append("保管人")
    if seal_data.department:
        seal.department = seal_data.department
        update_fields.append("部门")
    
    db.commit()
    
    return BusinessResponse(
        success=True,
        business_code="SEAL_UPDATED",
        message=f"印章「{seal.seal_name}」已更新，修改字段：{'、'.join(update_fields) if update_fields else '无'}",
        data={"seal_id": seal.id}
    )


@router.delete("/{seal_id}", response_model=BusinessResponse, summary="作废印章")
def deactivate_seal(seal_id: int, db: Session = Depends(get_db)):
    seal = db.query(Seal).filter(Seal.id == seal_id).first()
    if not seal:
        raise HTTPException(status_code=404, detail="印章不存在")
    
    if seal.status == SealStatus.BORROWED:
        raise HTTPException(
            status_code=400,
            detail=f"印章「{seal.seal_name}」当前处于外借状态，无法作废"
        )
    
    seal.is_active = False
    seal.status = SealStatus.SCRAPPED
    db.commit()
    
    return BusinessResponse(
        success=True,
        business_code="SEAL_SCRAPPED",
        message=f"印章「{seal.seal_name}」已作废",
        data={"seal_id": seal.id}
    )
