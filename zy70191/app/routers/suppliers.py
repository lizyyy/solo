from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SupplierType, SupplierStatus
from app.schemas import (
    Supplier, SupplierCreate, Qualification, QualificationCreate,
    PriceSnapshot, PriceSnapshotCreate
)
from app.services.supplier_service import SupplierService

router = APIRouter(prefix="/api/suppliers", tags=["供应商管理"])


@router.post("", response_model=Supplier, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_data: SupplierCreate, db: Session = Depends(get_db)):
    service = SupplierService(db)
    existing = service.get_supplier_by_code(supplier_data.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"供应商编码 {supplier_data.code} 已存在"
        )
    return service.create_supplier(supplier_data)


@router.get("", response_model=List[Supplier])
def list_suppliers(
    supplier_type: Optional[SupplierType] = None,
    db: Session = Depends(get_db)
):
    service = SupplierService(db)
    return service.get_all_suppliers(supplier_type)


@router.get("/alternative", response_model=List[Supplier])
def list_alternative_suppliers(db: Session = Depends(get_db)):
    service = SupplierService(db)
    return service.get_alternative_suppliers()


@router.get("/{supplier_id}", response_model=Supplier)
def get_supplier(supplier_id: int, db: Session = Depends(get_db)):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    return supplier


@router.patch("/{supplier_id}/status", response_model=Supplier)
def update_supplier_status(
    supplier_id: int,
    new_status: SupplierStatus,
    db: Session = Depends(get_db)
):
    service = SupplierService(db)
    supplier = service.update_supplier_status(supplier_id, new_status)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    return supplier


@router.post("/{supplier_id}/qualifications", response_model=Qualification, status_code=status.HTTP_201_CREATED)
def add_qualification(
    supplier_id: int,
    qual_data: QualificationCreate,
    db: Session = Depends(get_db)
):
    service = SupplierService(db)
    qualification = service.add_qualification(supplier_id, qual_data)
    if not qualification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    return qualification


@router.get("/{supplier_id}/qualifications", response_model=List[Qualification])
def list_qualifications(supplier_id: int, db: Session = Depends(get_db)):
    service = SupplierService(db)
    supplier = service.get_supplier(supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    return service.get_supplier_qualifications(supplier_id)


@router.post("/{supplier_id}/prices", response_model=PriceSnapshot, status_code=status.HTTP_201_CREATED)
def add_price_snapshot(
    supplier_id: int,
    ps_data: PriceSnapshotCreate,
    db: Session = Depends(get_db)
):
    service = SupplierService(db)
    price_snapshot = service.add_price_snapshot(supplier_id, ps_data)
    if not price_snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="供应商不存在"
        )
    return price_snapshot


@router.get("/{supplier_id}/prices/{product_code}", response_model=PriceSnapshot)
def get_current_price(
    supplier_id: int,
    product_code: str,
    db: Session = Depends(get_db)
):
    service = SupplierService(db)
    price = service.get_current_price(supplier_id, product_code)
    if not price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到产品 {product_code} 的价格信息"
        )
    return price
