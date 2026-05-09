from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Equipment, EquipmentGroup
from app.schemas import (
    EquipmentCreate, EquipmentUpdate, EquipmentResponse,
    EquipmentGroupCreate, EquipmentGroupUpdate, EquipmentGroupResponse
)

router = APIRouter(prefix="/api/equipment", tags=["设备管理"])


@router.post("/", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
def create_equipment(equipment: EquipmentCreate, db: Session = Depends(get_db)):
    """创建设备"""
    existing = db.query(Equipment).filter(Equipment.code == equipment.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"设备编号 {equipment.code} 已存在"
        )
    
    db_equipment = Equipment(**equipment.dict())
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.get("/", response_model=List[EquipmentResponse])
def list_equipment(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    group_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取设备列表"""
    query = db.query(Equipment)
    
    if status:
        query = query.filter(Equipment.status == status)
    if group_id:
        query = query.filter(Equipment.group_id == group_id)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(equipment_id: int, db: Session = Depends(get_db)):
    """获取单个设备"""
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"设备 {equipment_id} 不存在"
        )
    return equipment


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    equipment: EquipmentUpdate,
    db: Session = Depends(get_db)
):
    """更新设备"""
    db_equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not db_equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"设备 {equipment_id} 不存在"
        )
    
    update_data = equipment.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_equipment, key, value)
    
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    """删除设备"""
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"设备 {equipment_id} 不存在"
        )
    
    db.delete(equipment)
    db.commit()


@router.post("/groups/", response_model=EquipmentGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(group: EquipmentGroupCreate, db: Session = Depends(get_db)):
    """创建设备分组"""
    existing = db.query(EquipmentGroup).filter(EquipmentGroup.code == group.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"分组编号 {group.code} 已存在"
        )
    
    db_group = EquipmentGroup(**group.dict())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@router.get("/groups/", response_model=List[EquipmentGroupResponse])
def list_groups(
    skip: int = 0,
    limit: int = 100,
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取分组列表"""
    query = db.query(EquipmentGroup)
    
    if parent_id is not None:
        query = query.filter(EquipmentGroup.parent_id == parent_id)
    
    return query.offset(skip).limit(limit).all()


@router.get("/groups/{group_id}", response_model=EquipmentGroupResponse)
def get_group(group_id: int, db: Session = Depends(get_db)):
    """获取单个分组"""
    group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分组 {group_id} 不存在"
        )
    return group


@router.put("/groups/{group_id}", response_model=EquipmentGroupResponse)
def update_group(
    group_id: int,
    group: EquipmentGroupUpdate,
    db: Session = Depends(get_db)
):
    """更新分组"""
    db_group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分组 {group_id} 不存在"
        )
    
    update_data = group.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_group, key, value)
    
    db.commit()
    db.refresh(db_group)
    return db_group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    """删除分组"""
    group = db.query(EquipmentGroup).filter(EquipmentGroup.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分组 {group_id} 不存在"
        )
    
    if group.equipments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="分组下还有设备，无法删除"
        )
    
    db.delete(group)
    db.commit()
