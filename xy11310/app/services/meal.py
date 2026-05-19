from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Tuple
from datetime import date, datetime
import hashlib
import json

from app.models import Elderly, Menu, MealAllocation, MealStatus, MealType
from app.core.logging import app_logger
from app.services.history import HistoryService


DIETARY_DISEASE_MAP = {
    "糖尿病": ["低糖", "无糖", "糖尿病餐"],
    "高血压": ["低盐", "低脂", "高血压餐"],
    "痛风": ["低嘌呤"],
    "肾病": ["低盐", "优质蛋白"],
    "胃病": ["胃病餐", "软食", "半流质"]
}


class MealService:
    @staticmethod
    def generate_request_id(elderly_id: int, menu_date: date, meal_type: str) -> str:
        data = f"{elderly_id}-{menu_date.isoformat()}-{meal_type}"
        return hashlib.md5(data.encode()).hexdigest()
    
    @staticmethod
    def check_conflicts(elderly: Elderly, menu_items: List[str], allergens: List[str]) -> Tuple[bool, List[str]]:
        conflicts = []
        
        dietary_restrictions = elderly.dietary_restrictions or []
        chronic_diseases = elderly.chronic_diseases or []
        
        for restriction in dietary_restrictions:
            for item in menu_items:
                if restriction in item or any(allergen in item for allergen in allergens):
                    conflicts.append(f"菜品'{item}'与忌口'{restriction}'冲突")
        
        for disease in chronic_diseases:
            recommended = DIETARY_DISEASE_MAP.get(disease, [])
            if recommended and not any(rec in str(menu_items) for rec in recommended):
                conflicts.append(f"慢病'{disease}'建议使用特殊餐食")
        
        return len(conflicts) > 0, conflicts
    
    @staticmethod
    def allocate_meal(
        db: Session,
        elderly_id: int,
        menu_date: date,
        meal_type: MealType,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        request_id = MealService.generate_request_id(elderly_id, menu_date, meal_type)
        
        existing = db.query(MealAllocation).filter(
            MealAllocation.request_id == request_id
        ).first()
        
        if existing:
            app_logger.info(f"配餐已存在: {request_id}")
            return {
                "success": True,
                "is_duplicate": True,
                "allocation_id": existing.id,
                "request_id": request_id,
                "status": existing.status,
                "message": "配餐已存在，返回已有记录"
            }
        
        elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
        if not elderly:
            return {
                "success": False,
                "message": "老人信息不存在"
            }
        
        menu = db.query(Menu).filter(Menu.menu_date == menu_date).first()
        if not menu:
            return {
                "success": False,
                "message": "当日菜单不存在"
            }
        
        meal_items = getattr(menu, meal_type.value, []) or []
        meal_allergens = getattr(menu, f"{meal_type.value}_allergens", []) or []
        
        has_conflict, conflicts = MealService.check_conflicts(elderly, meal_items, meal_allergens)
        
        allocation = MealAllocation(
            request_id=request_id,
            elderly_id=elderly_id,
            menu_date=menu_date,
            meal_type=meal_type,
            status=MealStatus.PENDING,
            allocated_items=json.dumps(meal_items, ensure_ascii=False),
            conflicts=json.dumps(conflicts, ensure_ascii=False) if conflicts else None,
            has_conflict=1 if has_conflict else 0
        )
        
        db.add(allocation)
        db.commit()
        db.refresh(allocation)
        
        HistoryService.record_operation(
            db=db,
            operation_type="create",
            entity_type="MealAllocation",
            entity_id=allocation.id,
            after_data={
                "elderly_id": elderly_id,
                "menu_date": str(menu_date),
                "meal_type": meal_type.value,
                "has_conflict": has_conflict,
                "conflicts_count": len(conflicts)
            },
            operator=operator
        )
        
        app_logger.info(f"配餐成功: {request_id}, 冲突数量: {len(conflicts)}")
        
        return {
            "success": True,
            "is_duplicate": False,
            "allocation_id": allocation.id,
            "request_id": request_id,
            "status": allocation.status,
            "has_conflict": has_conflict,
            "conflicts": conflicts,
            "message": "配餐成功"
        }
    
    @staticmethod
    def batch_allocate_meals(
        db: Session,
        menu_date: date,
        meal_type: MealType,
        elderly_ids: Optional[List[int]] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        if elderly_ids is None:
            elderly_ids = [e.id for e in db.query(Elderly).filter(Elderly.is_active == True).all()]
        
        results = []
        success_count = 0
        duplicate_count = 0
        conflict_count = 0
        
        for elderly_id in elderly_ids:
            result = MealService.allocate_meal(db, elderly_id, menu_date, meal_type, operator)
            results.append(result)
            
            if result.get("success"):
                if result.get("is_duplicate"):
                    duplicate_count += 1
                else:
                    success_count += 1
                if result.get("has_conflict"):
                    conflict_count += 1
        
        return {
            "success": True,
            "total": len(elderly_ids),
            "success_count": success_count,
            "duplicate_count": duplicate_count,
            "conflict_count": conflict_count,
            "results": results
        }
    
    @staticmethod
    def modify_meal(
        db: Session,
        allocation_id: int,
        new_items: List[str],
        reason: str,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        allocation = db.query(MealAllocation).filter(MealAllocation.id == allocation_id).first()
        if not allocation:
            return {
                "success": False,
                "message": "配餐记录不存在"
            }
        
        before_data = HistoryService.get_entity_before_data(allocation)
        
        allocation.allocated_items = json.dumps(new_items, ensure_ascii=False)
        allocation.status = MealStatus.MODIFIED
        allocation.modified_by = operator
        allocation.modified_at = datetime.now()
        allocation.modified_reason = reason
        
        elderly = db.query(Elderly).filter(Elderly.id == allocation.elderly_id).first()
        if elderly:
            has_conflict, conflicts = MealService.check_conflicts(elderly, new_items, [])
            allocation.has_conflict = 1 if has_conflict else 0
            allocation.conflicts = json.dumps(conflicts, ensure_ascii=False) if conflicts else None
        
        after_data = HistoryService.get_entity_before_data(allocation)
        changes = HistoryService.calculate_changes(before_data, after_data)
        
        db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="MealAllocation",
            entity_id=allocation.id,
            before_data=before_data,
            after_data=after_data,
            changes=changes,
            operator=operator,
            notes=reason
        )
        
        app_logger.info(f"改餐成功: {allocation_id}, 原因: {reason}")
        
        return {
            "success": True,
            "allocation_id": allocation_id,
            "new_items": new_items,
            "message": "改餐成功"
        }
    
    @staticmethod
    def confirm_meal(
        db: Session,
        allocation_id: int,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        allocation = db.query(MealAllocation).filter(MealAllocation.id == allocation_id).first()
        if not allocation:
            return {
                "success": False,
                "message": "配餐记录不存在"
            }
        
        before_data = HistoryService.get_entity_before_data(allocation)
        allocation.status = MealStatus.CONFIRMED
        after_data = HistoryService.get_entity_before_data(allocation)
        
        db.commit()
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="MealAllocation",
            entity_id=allocation.id,
            before_data=before_data,
            after_data=after_data,
            changes=HistoryService.calculate_changes(before_data, after_data),
            operator=operator
        )
        
        return {
            "success": True,
            "allocation_id": allocation_id,
            "status": MealStatus.CONFIRMED,
            "message": "配餐已确认"
        }
    
    @staticmethod
    def get_conflicts_by_date(
        db: Session,
        menu_date: date
    ) -> Dict[str, Any]:
        allocations = db.query(MealAllocation).filter(
            MealAllocation.menu_date == menu_date,
            MealAllocation.has_conflict == 1
        ).all()
        
        conflict_list = []
        for alloc in allocations:
            elderly = db.query(Elderly).filter(Elderly.id == alloc.elderly_id).first()
            conflict_list.append({
                "allocation_id": alloc.id,
                "elderly_id": alloc.elderly_id,
                "elderly_name": elderly.name if elderly else None,
                "meal_type": alloc.meal_type.value,
                "conflicts": json.loads(alloc.conflicts) if alloc.conflicts else []
            })
        
        return {
            "success": True,
            "menu_date": str(menu_date),
            "conflict_count": len(conflict_list),
            "conflicts": conflict_list
        }
