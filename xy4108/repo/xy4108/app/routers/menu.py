from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import MenuItem, AuditAction
from ..schemas import (
    MenuItemCreate, MenuItemUpdate, MenuItemResponse
)
from ..services import AuditService

router = APIRouter(prefix="/menu", tags=["菜单管理"])


@router.get("/", response_model=List[MenuItemResponse])
def list_menu(
    menu_date: Optional[date] = None,
    meal_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MenuItem)
    if menu_date:
        query = query.filter(MenuItem.menu_date == menu_date)
    if meal_type:
        query = query.filter(MenuItem.meal_type == meal_type)
    return query.order_by(MenuItem.menu_date.desc(), MenuItem.meal_type).all()


@router.get("/{menu_id}", response_model=MenuItemResponse)
def get_menu_item(menu_id: int, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="菜单项目不存在")
    return item


@router.post("/", response_model=MenuItemResponse)
def create_menu_item(item: MenuItemCreate, db: Session = Depends(get_db)):
    db_item = MenuItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.CREATE,
        entity_type="MenuItem",
        entity_id=db_item.id,
        details={
            "dish_name": db_item.dish_name,
            "menu_date": str(db_item.menu_date),
            "meal_type": db_item.meal_type
        }
    )
    
    return db_item


@router.post("/batch", response_model=List[MenuItemResponse])
def create_menu_items(items: List[MenuItemCreate], db: Session = Depends(get_db)):
    db_items = []
    for item in items:
        db_item = MenuItem(**item.model_dump())
        db.add(db_item)
        db_items.append(db_item)
    
    db.commit()
    for item in db_items:
        db.refresh(item)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.CREATE,
        entity_type="MenuItem",
        details={"batch_count": len(db_items)}
    )
    
    return db_items


@router.put("/{menu_id}", response_model=MenuItemResponse)
def update_menu_item(
    menu_id: int,
    item_update: MenuItemUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="菜单项目不存在")
    
    update_data = item_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.UPDATE,
        entity_type="MenuItem",
        entity_id=item.id,
        details=update_data
    )
    
    return item


@router.delete("/{menu_id}")
def delete_menu_item(menu_id: int, db: Session = Depends(get_db)):
    item = db.query(MenuItem).filter(MenuItem.id == menu_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="菜单项目不存在")
    
    db.delete(item)
    db.commit()
    
    AuditService.log_action(
        db=db,
        action=AuditAction.DELETE,
        entity_type="MenuItem",
        entity_id=menu_id,
        details={"dish_name": item.dish_name}
    )
    
    return {"success": True, "message": "菜单项目已删除"}
