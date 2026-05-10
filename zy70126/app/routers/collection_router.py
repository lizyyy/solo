from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import CollectionItem
from app.schemas import CollectionItemCreate, CollectionItemUpdate, CollectionItem as CollectionItemSchema
from app.services.base_service import BaseService

router = APIRouter(prefix="/api/v1/collection", tags=["藏品档案"])
collection_service = BaseService(CollectionItem)


@router.post("", response_model=CollectionItemSchema)
def create_collection_item(data: CollectionItemCreate, db: Session = Depends(get_db)):
    existing = db.query(CollectionItem).filter(CollectionItem.item_code == data.item_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"藏品编号 {data.item_code} 已存在")
    
    item = collection_service.create(db, data.model_dump())
    return item


@router.get("", response_model=List[CollectionItemSchema])
def list_collection_items(
    skip: int = 0, 
    limit: int = 100, 
    available_only: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CollectionItem)
    if available_only is not None:
        query = query.filter(CollectionItem.is_available == available_only)
    return query.order_by(CollectionItem.id.desc()).offset(skip).limit(limit).all()


@router.get("/{item_id}", response_model=CollectionItemSchema)
def get_collection_item(item_id: int, db: Session = Depends(get_db)):
    item = collection_service.get(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"藏品 {item_id} 不存在")
    return item


@router.patch("/{item_id}", response_model=CollectionItemSchema)
def update_collection_item(item_id: int, data: CollectionItemUpdate, db: Session = Depends(get_db)):
    item = collection_service.get(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"藏品 {item_id} 不存在")
    
    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_data:
        return item
    
    updated = collection_service.update(db, item, update_data)
    return updated
