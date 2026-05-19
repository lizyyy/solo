from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import date, datetime

from app.models import Menu
from app.core.logging import app_logger
from app.services.history import HistoryService


class MenuService:
    @staticmethod
    def create_menu(
        db: Session,
        menu_date: date,
        breakfast: Optional[List[str]] = None,
        lunch: Optional[List[str]] = None,
        dinner: Optional[List[str]] = None,
        breakfast_allergens: Optional[List[str]] = None,
        lunch_allergens: Optional[List[str]] = None,
        dinner_allergens: Optional[List[str]] = None,
        notes: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        
        existing = db.query(Menu).filter(Menu.menu_date == menu_date).first()
        if existing:
            return {
                "success": True,
                "is_duplicate": True,
                "menu_id": existing.id,
                "message": "当日菜单已存在"
            }
        
        menu = Menu(
            menu_date=menu_date,
            breakfast=breakfast or [],
            lunch=lunch or [],
            dinner=dinner or [],
            breakfast_allergens=breakfast_allergens or [],
            lunch_allergens=lunch_allergens or [],
            dinner_allergens=dinner_allergens or [],
            notes=notes
        )
        
        db.add(menu)
        db.commit()
        db.refresh(menu)
        
        HistoryService.record_operation(
            db=db,
            operation_type="create",
            entity_type="Menu",
            entity_id=menu.id,
            after_data={"menu_date": str(menu_date)},
            operator=operator
        )
        
        app_logger.info(f"创建菜单成功: {menu_date}")
        
        return {
            "success": True,
            "is_duplicate": False,
            "menu_id": menu.id,
            "message": "菜单创建成功"
        }
    
    @staticmethod
    def update_menu(
        db: Session,
        menu_id: int,
        update_data: Dict[str, Any],
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        menu = db.query(Menu).filter(Menu.id == menu_id).first()
        if not menu:
            return {"success": False, "message": "菜单不存在"}
        
        before_data = HistoryService.get_entity_before_data(menu)
        
        for key, value in update_data.items():
            if hasattr(menu, key):
                setattr(menu, key, value)
        
        menu.updated_at = datetime.now()
        
        db.commit()
        
        after_data = HistoryService.get_entity_before_data(menu)
        changes = HistoryService.calculate_changes(before_data, after_data)
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="Menu",
            entity_id=menu.id,
            before_data=before_data,
            after_data=after_data,
            changes=changes,
            operator=operator
        )
        
        app_logger.info(f"更新菜单成功: {menu_id}")
        
        return {
            "success": True,
            "menu_id": menu_id,
            "message": "菜单更新成功"
        }
    
    @staticmethod
    def get_menu(
        db: Session,
        menu_date: date
    ) -> Dict[str, Any]:
        menu = db.query(Menu).filter(Menu.menu_date == menu_date).first()
        if not menu:
            return {"success": False, "message": "菜单不存在"}
        
        data = {
            "id": menu.id,
            "menu_date": str(menu.menu_date),
            "breakfast": menu.breakfast,
            "lunch": menu.lunch,
            "dinner": menu.dinner,
            "breakfast_allergens": menu.breakfast_allergens,
            "lunch_allergens": menu.lunch_allergens,
            "dinner_allergens": menu.dinner_allergens,
            "notes": menu.notes
        }
        
        return {
            "success": True,
            "data": data
        }
