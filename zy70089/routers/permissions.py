from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import PollutantType
from schemas import (
    PermissionCreate, PermissionUpdate, PermissionResponse
)
from services import PermissionService

router = APIRouter(prefix="/api/v1/permissions", tags=["排污许可指标"])


@router.post("", response_model=PermissionResponse, summary="创建排污许可指标")
def create_permission(data: PermissionCreate, db: Session = Depends(get_db)):
    return PermissionService.create(db, data)


@router.put("/{permit_id}", response_model=PermissionResponse, summary="更新排污许可指标")
def update_permission(permit_id: int, data: PermissionUpdate, db: Session = Depends(get_db)):
    return PermissionService.update(db, permit_id, data)


@router.get("/{permit_id}", response_model=PermissionResponse, summary="获取单个排污许可")
def get_permission(permit_id: int, db: Session = Depends(get_db)):
    from models import Permission
    permission = db.query(Permission).filter(Permission.id == permit_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="许可证不存在")
    return permission


@router.get("/no/{permit_no}", response_model=PermissionResponse, summary="按许可证编号获取")
def get_permission_by_no(permit_no: str, db: Session = Depends(get_db)):
    return PermissionService.get_by_permit_no(db, permit_no)


@router.get("", response_model=List[PermissionResponse], summary="查询排污许可列表")
def list_permissions(
    enterprise_name: Optional[str] = None,
    pollutant_type: Optional[PollutantType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return PermissionService.list(db, enterprise_name, pollutant_type, skip, limit)


@router.delete("/{permit_id}", summary="删除排污许可")
def delete_permission(permit_id: int, db: Session = Depends(get_db)):
    from models import Permission, DetectionReport
    permission = db.query(Permission).filter(Permission.id == permit_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="许可证不存在")
    
    has_reports = db.query(DetectionReport).filter(
        DetectionReport.permission_id == permit_id
    ).first()
    
    if has_reports:
        raise HTTPException(status_code=400, detail="该许可证下存在检测报告，无法删除")
    
    db.delete(permission)
    db.commit()
    return {"message": "删除成功"}
