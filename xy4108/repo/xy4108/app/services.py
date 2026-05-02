from typing import List, Dict, Optional
from datetime import date
from sqlalchemy.orm import Session
from .models import (
    Child, MenuItem, Ingredient, SubstitutionRequest, AuditLog, BlockRecord,
    BatchStatus, SubstitutionStatus, AuditAction
)
from .rules_engine import AllergenRulesEngine, BatchRulesEngine, SubstitutionRulesEngine
from .schemas import ImportResult
import json


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: AuditAction,
        entity_type: str,
        entity_id: Optional[int] = None,
        details: Optional[Dict] = None,
        operator: Optional[str] = None
    ):
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=json.dumps(details, ensure_ascii=False) if details else None,
            operator=operator
        )
        db.add(log)
        db.commit()
        return log


class MealPlanningService:
    @staticmethod
    def generate_daily_meal_plan(
        db: Session,
        plan_date: date,
        operator: Optional[str] = None
    ) -> Dict:
        menu_items = db.query(MenuItem).filter(MenuItem.menu_date == plan_date).all()
        children = db.query(Child).filter(Child.is_active == True).all()
        ingredients = db.query(Ingredient).all()
        
        if not menu_items:
            return {
                "date": plan_date,
                "has_menu": False,
                "message": f"未找到{plan_date}的菜单数据"
            }

        meal_types = list(set([item.meal_type for item in menu_items]))
        result = {
            "date": plan_date,
            "has_menu": True,
            "meal_plans": [],
            "summary": {
                "total_children": len(children),
                "total_dishes": len(menu_items),
                "safe_assignments": 0,
                "blocked_assignments": 0,
                "substitutions_needed": 0,
                "has_recalled_batches": False,
                "has_expired_batches": False
            }
        }

        all_recalled = []
        all_expired = []

        for meal_type in sorted(meal_types):
            meal_menu = [m for m in menu_items if m.meal_type == meal_type]
            meal_plan = {
                "meal_type": meal_type,
                "dishes": [],
                "safe_assignments": [],
                "blocked_assignments": [],
                "substitutions_needed": [],
                "batch_warnings": []
            }

            for dish in meal_menu:
                dish_info = {
                    "dish_name": dish.dish_name,
                    "allergens": dish.allergens,
                    "ingredients": dish.ingredients,
                    "assigned_children": [],
                    "blocked_children": [],
                    "batch_check": None
                }

                batch_check = BatchRulesEngine.check_dish_uses_recalled_batch(dish, ingredients)
                dish_info["batch_check"] = batch_check
                
                if batch_check["has_recalled"]:
                    all_recalled.extend(batch_check["recalled_ingredients"])
                    meal_plan["batch_warnings"].append({
                        "dish": dish.dish_name,
                        "type": "召回批次",
                        "details": batch_check["recalled_ingredients"]
                    })
                if batch_check["has_expired"]:
                    all_expired.extend(batch_check["expired_ingredients"])
                    meal_plan["batch_warnings"].append({
                        "dish": dish.dish_name,
                        "type": "过期批次",
                        "details": batch_check["expired_ingredients"]
                    })

                for child in children:
                    compatibility = AllergenRulesEngine.check_child_dish_compatibility(child, dish)
                    
                    child_info = {
                        "child_name": child.name,
                        "student_id": child.student_id,
                        "class_name": child.class_name,
                        "risk_level": compatibility["risk_level"],
                        "recommendation": compatibility["recommendation"]
                    }

                    if not batch_check["is_safe"]:
                        blocked_record = BlockRecord(
                            child_id=child.id,
                            menu_item_id=dish.id,
                            block_date=plan_date,
                            reason="菜品使用召回/过期食材",
                            allergens_found=json.dumps(batch_check, ensure_ascii=False)
                        )
                        db.add(blocked_record)
                        
                        dish_info["blocked_children"].append({
                            **child_info,
                            "block_reason": "批次问题"
                        })
                        meal_plan["blocked_assignments"].append({
                            "dish": dish.dish_name,
                            **child_info,
                            "block_reason": "批次问题"
                        })
                    elif compatibility["has_conflict"]:
                        blocked_record = BlockRecord(
                            child_id=child.id,
                            menu_item_id=dish.id,
                            block_date=plan_date,
                            reason="过敏原/禁忌食材冲突",
                            allergens_found=json.dumps(compatibility["matched_allergens"] + compatibility["matched_forbidden"], ensure_ascii=False)
                        )
                        db.add(blocked_record)
                        
                        dish_info["blocked_children"].append({
                            **child_info,
                            "block_reason": "过敏原冲突",
                            "matched_allergens": compatibility["matched_allergens"],
                            "matched_forbidden": compatibility["matched_forbidden"]
                        })
                        meal_plan["blocked_assignments"].append({
                            "dish": dish.dish_name,
                            **child_info,
                            "block_reason": "过敏原冲突",
                            "matched_allergens": compatibility["matched_allergens"]
                        })
                        
                        pending_sub = db.query(SubstitutionRequest).filter(
                            SubstitutionRequest.child_id == child.id,
                            SubstitutionRequest.menu_item_id == dish.id,
                            SubstitutionRequest.status.in_([
                                SubstitutionStatus.PENDING, 
                                SubstitutionStatus.APPROVED
                            ])
                        ).first()
                        
                        if pending_sub:
                            meal_plan["substitutions_needed"].append({
                                "dish": dish.dish_name,
                                **child_info,
                                "substitution_status": pending_sub.status.value,
                                "substitution_dish": pending_sub.substitution_dish
                            })
                    else:
                        dish_info["assigned_children"].append(child_info)
                        meal_plan["safe_assignments"].append({
                            "dish": dish.dish_name,
                            **child_info
                        })

                meal_plan["dishes"].append(dish_info)

            result["meal_plans"].append(meal_plan)
            
            result["summary"]["safe_assignments"] += len(meal_plan["safe_assignments"])
            result["summary"]["blocked_assignments"] += len(meal_plan["blocked_assignments"])
            result["summary"]["substitutions_needed"] += len(meal_plan["substitutions_needed"])

        result["summary"]["has_recalled_batches"] = len(all_recalled) > 0
        result["summary"]["has_expired_batches"] = len(all_expired) > 0

        AuditService.log_action(
            db=db,
            action=AuditAction.CREATE,
            entity_type="MealPlan",
            details=result["summary"],
            operator=operator
        )
        db.commit()

        return result

    @staticmethod
    def get_block_list(
        db: Session,
        block_date: Optional[date] = None
    ) -> List[Dict]:
        query = db.query(BlockRecord)
        
        if block_date:
            query = query.filter(BlockRecord.block_date == block_date)
        
        block_records = query.order_by(BlockRecord.block_date.desc()).all()
        
        result = []
        for record in block_records:
            child = db.query(Child).get(record.child_id)
            menu_item = db.query(MenuItem).get(record.menu_item_id)
            
            result.append({
                "id": record.id,
                "block_date": record.block_date,
                "child_name": child.name if child else "未知",
                "student_id": child.student_id if child else "未知",
                "class_name": child.class_name if child else "未知",
                "dish_name": menu_item.dish_name if menu_item else "未知",
                "meal_type": menu_item.meal_type if menu_item else "未知",
                "reason": record.reason,
                "allergens_found": record.allergens_found,
                "is_substituted": record.is_substituted,
                "substitution_id": record.substitution_id
            })
        
        return result


class SubstitutionService:
    @staticmethod
    def approve_substitution(
        db: Session,
        request_id: int,
        approver: str,
        approval_notes: Optional[str] = None,
        substitution_dish: Optional[str] = None
    ) -> Dict:
        request = db.query(SubstitutionRequest).get(request_id)
        
        if not request:
            return {"success": False, "message": "替餐申请不存在"}
        
        can_approve, message = SubstitutionRulesEngine.can_approve_substitution(request)
        if not can_approve:
            return {"success": False, "message": message}
        
        if substitution_dish:
            request.substitution_dish = substitution_dish
        
        request.status = SubstitutionStatus.APPROVED
        request.approver = approver
        request.approval_notes = approval_notes
        
        AuditService.log_action(
            db=db,
            action=AuditAction.APPROVE,
            entity_type="SubstitutionRequest",
            entity_id=request.id,
            details={
                "original_dish": request.original_dish,
                "substitution_dish": request.substitution_dish,
                "approver": approver
            },
            operator=approver
        )
        
        db.commit()
        return {"success": True, "message": "审批通过", "status": request.status.value}

    @staticmethod
    def reject_substitution(
        db: Session,
        request_id: int,
        approver: str,
        rejection_reason: str
    ) -> Dict:
        request = db.query(SubstitutionRequest).get(request_id)
        
        if not request:
            return {"success": False, "message": "替餐申请不存在"}
        
        can_reject, message = SubstitutionRulesEngine.can_reject_substitution(request)
        if not can_reject:
            return {"success": False, "message": message}
        
        request.status = SubstitutionStatus.REJECTED
        request.approver = approver
        request.approval_notes = rejection_reason
        
        AuditService.log_action(
            db=db,
            action=AuditAction.REJECT,
            entity_type="SubstitutionRequest",
            entity_id=request.id,
            details={
                "original_dish": request.original_dish,
                "rejection_reason": rejection_reason,
                "approver": approver
            },
            operator=approver
        )
        
        db.commit()
        return {"success": True, "message": "已拒绝", "status": request.status.value}

    @staticmethod
    def implement_substitution(
        db: Session,
        request_id: int,
        operator: str
    ) -> Dict:
        request = db.query(SubstitutionRequest).get(request_id)
        
        if not request:
            return {"success": False, "message": "替餐申请不存在"}
        
        can_implement, message = SubstitutionRulesEngine.can_implement_substitution(request)
        if not can_implement:
            return {"success": False, "message": message}
        
        request.status = SubstitutionStatus.IMPLEMENTED
        
        block_record = db.query(BlockRecord).filter(
            BlockRecord.child_id == request.child_id,
            BlockRecord.menu_item_id == request.menu_item_id
        ).first()
        
        if block_record:
            block_record.is_substituted = True
            block_record.substitution_id = request.id
        
        AuditService.log_action(
            db=db,
            action=AuditAction.SUBSTITUTE,
            entity_type="SubstitutionRequest",
            entity_id=request.id,
            details={
                "original_dish": request.original_dish,
                "substitution_dish": request.substitution_dish,
                "operator": operator
            },
            operator=operator
        )
        
        db.commit()
        return {"success": True, "message": "替餐已执行", "status": request.status.value}


class BatchService:
    @staticmethod
    def recall_batch(
        db: Session,
        batch_number: str,
        reason: str,
        operator: str
    ) -> Dict:
        ingredients = db.query(Ingredient).filter(
            Ingredient.batch_number == batch_number
        ).all()
        
        if not ingredients:
            return {"success": False, "message": f"未找到批次号为 {batch_number} 的食材"}
        
        updated_count = 0
        for ing in ingredients:
            if ing.status != BatchStatus.RECALLED:
                ing.status = BatchStatus.RECALLED
                ing.recall_reason = reason
                updated_count += 1
                
                AuditService.log_action(
                    db=db,
                    action=AuditAction.BLOCK,
                    entity_type="Ingredient",
                    entity_id=ing.id,
                    details={
                        "batch_number": batch_number,
                        "ingredient_name": ing.name,
                        "reason": reason
                    },
                    operator=operator
                )
        
        db.commit()
        
        return {
            "success": True,
            "message": f"已召回 {updated_count} 个食材批次",
            "batch_number": batch_number,
            "updated_count": updated_count
        }
