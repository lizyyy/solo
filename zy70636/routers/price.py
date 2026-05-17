from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Price as PriceModel, Category as CategoryModel
from schemas import Price, PriceCreate, APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse)
def create_price(price: PriceCreate, db: Session = Depends(get_db)):
    category = db.query(CategoryModel).filter(CategoryModel.id == price.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="品类不存在")
    
    db.query(PriceModel).filter(
        PriceModel.category_id == price.category_id,
        PriceModel.is_active == True
    ).update({"is_active": False})
    
    max_version = db.query(PriceModel).filter(
        PriceModel.category_id == price.category_id
    ).count()
    
    db_price = PriceModel(
        **price.model_dump(),
        version=max_version + 1,
        is_active=True
    )
    db.add(db_price)
    db.commit()
    db.refresh(db_price)
    return APIResponse(success=True, message="价格创建成功", data={"price": Price.model_validate(db_price).model_dump()})


@router.get("/", response_model=List[Price])
def list_prices(category_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(PriceModel)
    if category_id:
        query = query.filter(PriceModel.category_id == category_id)
    prices = query.order_by(PriceModel.version.desc()).offset(skip).limit(limit).all()
    return prices


@router.get("/{price_id}", response_model=Price)
def get_price(price_id: int, db: Session = Depends(get_db)):
    price = db.query(PriceModel).filter(PriceModel.id == price_id).first()
    if not price:
        raise HTTPException(status_code=404, detail="价格不存在")
    return price


@router.get("/category/{category_id}/active", response_model=Price)
def get_active_price(category_id: int, db: Session = Depends(get_db)):
    price = db.query(PriceModel).filter(
        PriceModel.category_id == category_id,
        PriceModel.is_active == True
    ).first()
    if not price:
        raise HTTPException(status_code=404, detail="该品类无有效价格")
    return price
