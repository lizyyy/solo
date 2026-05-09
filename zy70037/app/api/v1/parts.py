from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.parts import (
    Part,
    PartCreate,
    PartUpdate,
    PartQuery,
    PartsUsage,
    PartsUsageCreate,
)
from app.schemas.base import ResponseModel, PaginatedResponse
from app.services.parts_service import PartService, PartsUsageService

router = APIRouter(prefix="/parts", tags=["parts"])


@router.get("", response_model=PaginatedResponse[Part])
def list_parts(
    name: str = Query(None),
    code: str = Query(None),
    category: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = PartService(db)
    query_params = PartQuery(
        name=name,
        code=code,
        category=category,
        page=page,
        page_size=page_size,
    )
    parts, total = service.list_parts(query_params)
    return PaginatedResponse(
        data=[Part.model_validate(p) for p in parts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{part_id}", response_model=ResponseModel[Part])
def get_part(part_id: int, db: Session = Depends(get_db)):
    service = PartService(db)
    part = service.get_part_by_id(part_id)
    if not part:
        raise HTTPException(status_code=404, detail="配件不存在")
    return ResponseModel(data=Part.model_validate(part))


@router.post("", response_model=ResponseModel[Part])
def create_part(data: PartCreate, db: Session = Depends(get_db)):
    service = PartService(db)
    part = service.create_part(data)
    return ResponseModel(data=Part.model_validate(part), message="配件创建成功")


@router.put("/{part_id}", response_model=ResponseModel[Part])
def update_part(part_id: int, data: PartUpdate, db: Session = Depends(get_db)):
    service = PartService(db)
    part = service.update_part(part_id, data)
    if not part:
        raise HTTPException(status_code=404, detail="配件不存在")
    return ResponseModel(data=Part.model_validate(part), message="配件更新成功")


@router.delete("/{part_id}", response_model=ResponseModel)
def delete_part(part_id: int, db: Session = Depends(get_db)):
    service = PartService(db)
    if not service.delete_part(part_id):
        raise HTTPException(status_code=404, detail="配件不存在")
    return ResponseModel(message="配件删除成功")


@router.get("/receipt/{receipt_id}/usages", response_model=ResponseModel[List[PartsUsage]])
def get_parts_usage_by_receipt(receipt_id: int, db: Session = Depends(get_db)):
    service = PartsUsageService(db)
    usages = service.get_by_receipt(receipt_id)
    return ResponseModel(data=[PartsUsage.model_validate(u) for u in usages])


@router.post("/usages", response_model=ResponseModel[PartsUsage])
def create_parts_usage(data: PartsUsageCreate, db: Session = Depends(get_db)):
    service = PartsUsageService(db)
    usage = service.create(data)
    if not usage:
        raise HTTPException(status_code=400, detail="库存不足或配件不存在")
    return ResponseModel(data=PartsUsage.model_validate(usage), message="配件使用记录创建成功")


@router.delete("/usages/{usage_id}", response_model=ResponseModel)
def delete_parts_usage(usage_id: int, db: Session = Depends(get_db)):
    service = PartsUsageService(db)
    if not service.delete(usage_id):
        raise HTTPException(status_code=404, detail="配件使用记录不存在")
    return ResponseModel(message="配件使用记录删除成功")
