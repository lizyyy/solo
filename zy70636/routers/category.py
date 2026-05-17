from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Category as CategoryModel
from schemas import Category, CategoryCreate, CategoryUpdate, APIResponse

router = APIRouter()


@router.post("/", response_model=APIResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(CategoryModel).filter(CategoryModel.code == category.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="品类编码已存在")
    
    db_category = CategoryModel(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return APIResponse(success=True, message="品类创建成功", data={"category": Category.model_validate(db_category).model_dump()})


@router.get("/", response_model=List[Category])
def list_categories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    categories = db.query(CategoryModel).offset(skip).limit(limit).all()
    return categories


@router.get("/{category_id}", response_model=Category)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(CategoryModel).filter(CategoryModel.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="品类不存在")
    return category


@router.put("/{category_id}", response_model=APIResponse)
def update_category(category_id: int, category: CategoryUpdate, db: Session = Depends(get_db)):
    db_category = db.query(CategoryModel).filter(CategoryModel.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="品类不存在")
    
    if category.code and category.code != db_category.code:
        existing = db.query(CategoryModel).filter(CategoryModel.code == category.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="品类编码已存在")
    
    update_data = category.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_category, key, value)
    
    db.commit()
    db.refresh(db_category)
    return APIResponse(success=True, message="品类更新成功", data={"category": Category.model_validate(db_category).model_dump()})


@router.delete("/{category_id}", response_model=APIResponse)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    db_category = db.query(CategoryModel).filter(CategoryModel.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="品类不存在")
    
    db_category.is_active = False
    db.commit()
    return APIResponse(success=True, message="品类已禁用")
