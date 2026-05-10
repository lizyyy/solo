from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.store import Store
from ..schemas import StoreCreate, StoreResponse

router = APIRouter(prefix="/api/stores", tags=["stores"])


@router.post("", response_model=StoreResponse)
def create_store(data: StoreCreate, db: Session = Depends(get_db)):
    existing = db.query(Store).filter(Store.store_code == data.store_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="门店编码已存在")
    
    store = Store(
        store_code=data.store_code,
        store_name=data.store_name,
        city=data.city,
        address=data.address,
        manager=data.manager,
        is_active=True
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("", response_model=List[StoreResponse])
def list_stores(db: Session = Depends(get_db)):
    return db.query(Store).order_by(Store.id.asc()).all()


@router.get("/{store_id}", response_model=StoreResponse)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    return store
