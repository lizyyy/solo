from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..models import Material
from ..schemas import (
    MaterialCreate,
    MaterialUpdate,
    MaterialResponse,
    PaginationParams,
    PaginatedResponse,
    SuccessResponse,
)
from ..api.deps import get_db_session

router = APIRouter(prefix="/materials", tags=["材料管理"])


@router.get("", response_model=SuccessResponse[PaginatedResponse[MaterialResponse]])
def list_materials(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    material_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db_session),
):
    query = db.query(Material)
    if material_type:
        query = query.filter(Material.material_type == material_type)
    if is_active is not None:
        query = query.filter(Material.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(Material.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return SuccessResponse(
        data=PaginatedResponse(
            items=[MaterialResponse.model_validate(m) for m in items],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=(total + page_size - 1) // page_size,
        )
    )


@router.post("", response_model=SuccessResponse[MaterialResponse], status_code=201)
def create_material(
    data: MaterialCreate,
    db: Session = Depends(get_db_session),
):
    material = Material(**data.model_dump())
    db.add(material)
    db.commit()
    db.refresh(material)
    return SuccessResponse(data=MaterialResponse.model_validate(material))


@router.get("/{material_id}", response_model=SuccessResponse[MaterialResponse])
def get_material(
    material_id: int,
    db: Session = Depends(get_db_session),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"材料 {material_id} 不存在",
        )
    return SuccessResponse(data=MaterialResponse.model_validate(material))


@router.put("/{material_id}", response_model=SuccessResponse[MaterialResponse])
def update_material(
    material_id: int,
    data: MaterialUpdate,
    db: Session = Depends(get_db_session),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"材料 {material_id} 不存在",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(material, field, value)

    db.commit()
    db.refresh(material)
    return SuccessResponse(data=MaterialResponse.model_validate(material))


@router.delete("/{material_id}", response_model=SuccessResponse[dict])
def delete_material(
    material_id: int,
    db: Session = Depends(get_db_session),
):
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"材料 {material_id} 不存在",
        )

    db.delete(material)
    db.commit()
    return SuccessResponse(data={"message": "删除成功"})
