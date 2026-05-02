from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..services import MealPlanningService
from ..rules_engine import AllergenRulesEngine
from ..models import Child, MenuItem

router = APIRouter(prefix="/meal-plan", tags=["分餐计划"])


@router.post("/generate")
def generate_meal_plan(
    plan_date: date,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return MealPlanningService.generate_daily_meal_plan(
        db=db,
        plan_date=plan_date,
        operator=operator
    )


@router.get("/block-list")
def get_block_list(
    block_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    return MealPlanningService.get_block_list(
        db=db,
        block_date=block_date
    )


@router.post("/check-compatibility")
def check_compatibility(
    child_id: int,
    menu_item_id: int,
    db: Session = Depends(get_db)
):
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        return {"success": False, "message": "儿童档案不存在"}
    
    menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu_item:
        return {"success": False, "message": "菜单项目不存在"}
    
    result = AllergenRulesEngine.check_child_dish_compatibility(child, menu_item)
    
    return {
        "success": True,
        "compatibility": result
    }
