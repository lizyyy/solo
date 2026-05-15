from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


@router.get("/", response_model=List[schemas.InternalCatalog])
def list_catalog(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(models.InternalCatalog).offset(skip).limit(limit).all()
    return items


@router.get("/{item_id}", response_model=schemas.InternalCatalog)
def get_catalog_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.InternalCatalog).filter(models.InternalCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return item


@router.post("/", response_model=schemas.InternalCatalog)
def create_catalog_item(item: schemas.InternalCatalogCreate, db: Session = Depends(get_db)):
    db_item = db.query(models.InternalCatalog).filter(
        models.InternalCatalog.internal_sku == item.internal_sku
    ).first()
    if db_item:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    db_item = models.InternalCatalog(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
