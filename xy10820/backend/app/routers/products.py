from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/supplier/{supplier_id}", response_model=List[schemas.SupplierProduct])
def list_supplier_products(
    supplier_id: int,
    skip: int = 0,
    limit: int = 100,
    is_dirty: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.SupplierProduct).filter(
        models.SupplierProduct.supplier_id == supplier_id
    )
    if is_dirty is not None:
        query = query.filter(models.SupplierProduct.is_dirty == is_dirty)
    
    products = query.offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=schemas.SupplierProduct)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.SupplierProduct).filter(models.SupplierProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
