from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import Store, InspectionItem, DeductionRule
from ..schemas import (
    StoreCreate, StoreResponse,
    InspectionItemCreate, InspectionItemResponse,
    DeductionRuleCreate, DeductionRuleResponse
)

router = APIRouter(prefix="/api/master", tags=["基础数据"])


@router.post("/stores", response_model=StoreResponse, status_code=201)
def create_store(data: StoreCreate, db: Session = Depends(get_db)):
    existing = db.query(Store).filter(Store.code == data.code).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"门店编码 {data.code} 已存在"
        )
    store = Store(**data.dict())
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("/stores", response_model=List[StoreResponse])
def list_stores(
    region: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Store)
    if region:
        query = query.filter(Store.region == region)
    if is_active is not None:
        query = query.filter(Store.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.get("/stores/{store_id}", response_model=StoreResponse)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    return store


@router.post("/items", response_model=InspectionItemResponse, status_code=201)
def create_item(data: InspectionItemCreate, db: Session = Depends(get_db)):
    existing = db.query(InspectionItem).filter(
        InspectionItem.code == data.code
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"巡检项编码 {data.code} 已存在"
        )
    item = InspectionItem(**data.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/items", response_model=List[InspectionItemResponse])
def list_items(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionItem)
    if category:
        query = query.filter(InspectionItem.category == category)
    if is_active is not None:
        query = query.filter(InspectionItem.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.post("/deduction-rules", response_model=DeductionRuleResponse, status_code=201)
def create_deduction_rule(data: DeductionRuleCreate, db: Session = Depends(get_db)):
    rule = DeductionRule(**data.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/deduction-rules", response_model=List[DeductionRuleResponse])
def list_deduction_rules(
    item_category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeductionRule).filter(DeductionRule.is_active == True)
    if item_category:
        query = query.filter(DeductionRule.item_category == item_category)
    return query.all()
