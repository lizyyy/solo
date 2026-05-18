from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime

from app import models, schemas


def calculate_total_value(items: List) -> float:
    total = 0.0
    for item in items:
        if isinstance(item, dict):
            total += item["quantity"] * item["unit_price"]
        else:
            total += item.quantity * item.unit_price
    return total


def calculate_completeness_score(
    original_items: List[models.LightingSetItem],
    current_items: List
) -> float:
    if not original_items:
        return 100.0
    
    original_map = {(item.item_code, item.item_name): item.quantity for item in original_items}
    
    current_map = {}
    for item in current_items:
        if isinstance(item, dict):
            key = (item["item_code"], item["item_name"])
            current_map[key] = item["quantity"]
        else:
            key = (item.item_code, item.item_name)
            current_map[key] = item.quantity
    
    matched_count = 0
    total_count = len(original_map)
    
    for key, orig_qty in original_map.items():
        if key in current_map and current_map[key] == orig_qty:
            matched_count += 1
    
    if total_count == 0:
        return 100.0
    
    return (matched_count / total_count) * 100


def get_lighting_set(db: Session, lighting_set_id: int):
    return db.query(models.LightingSet).filter(models.LightingSet.id == lighting_set_id).first()


def get_lighting_set_by_code(db: Session, set_code: str):
    return db.query(models.LightingSet).filter(models.LightingSet.set_code == set_code).first()


def get_lighting_sets(
    db: Session,
    query: schemas.LightingSetQuery,
    skip: int = 0,
    limit: int = 100
):
    q = db.query(models.LightingSet)
    
    if query.set_code:
        q = q.filter(models.LightingSet.set_code.contains(query.set_code))
    if query.set_name:
        q = q.filter(models.LightingSet.set_name.contains(query.set_name))
    if query.store:
        q = q.filter(models.LightingSet.store == query.store)
    if query.responsible_person:
        q = q.filter(models.LightingSet.responsible_person == query.responsible_person)
    if query.status:
        q = q.filter(models.LightingSet.status == query.status)
    if query.start_date:
        q = q.filter(models.LightingSet.created_date >= query.start_date)
    if query.end_date:
        q = q.filter(models.LightingSet.created_date <= query.end_date)
    if query.customer_name:
        q = q.filter(models.LightingSet.customer_name.contains(query.customer_name))
    
    return q.offset(skip).limit(limit).all()


def create_lighting_set(db: Session, lighting_set: schemas.LightingSetCreate):
    total_value = calculate_total_value(lighting_set.items)
    
    db_set = models.LightingSet(
        set_code=lighting_set.set_code,
        set_name=lighting_set.set_name,
        store=lighting_set.store,
        responsible_person=lighting_set.responsible_person,
        status=lighting_set.status,
        total_value=total_value,
        daily_rental_price=lighting_set.daily_rental_price,
        expected_return_date=lighting_set.expected_return_date,
        actual_return_date=lighting_set.actual_return_date,
        customer_name=lighting_set.customer_name,
        customer_phone=lighting_set.customer_phone,
        event_name=lighting_set.event_name,
        event_location=lighting_set.event_location,
        remarks=lighting_set.remarks,
        completeness_score=100.0
    )
    
    for item in lighting_set.items:
        db_item = models.LightingSetItem(**item.model_dump())
        db_set.items.append(db_item)
    
    db.add(db_set)
    db.commit()
    db.refresh(db_set)
    return db_set


def update_lighting_set(
    db: Session,
    lighting_set_id: int,
    lighting_set_update: schemas.LightingSetUpdate
):
    db_set = get_lighting_set(db, lighting_set_id)
    if not db_set:
        return None
    
    update_data = lighting_set_update.model_dump(exclude_unset=True)
    
    if "items" in update_data:
        items_data = update_data.pop("items")
        completeness_score = calculate_completeness_score(db_set.items, items_data)
        update_data["completeness_score"] = completeness_score
        
        total_value = calculate_total_value(items_data)
        update_data["total_value"] = total_value
        
        db.query(models.LightingSetItem).filter(
            models.LightingSetItem.lighting_set_id == lighting_set_id
        ).delete()
        
        for item_data in items_data:
            db_item = models.LightingSetItem(**item_data)
            db_item.lighting_set_id = lighting_set_id
            db.add(db_item)
    
    for field, value in update_data.items():
        setattr(db_set, field, value)
    
    db.commit()
    db.refresh(db_set)
    return db_set


def delete_lighting_set(db: Session, lighting_set_id: int):
    db_set = get_lighting_set(db, lighting_set_id)
    if not db_set:
        return False
    db.delete(db_set)
    db.commit()
    return True


def batch_import_lighting_sets(db: Session, lighting_sets: List[schemas.LightingSetCreate]):
    results = []
    success_count = 0
    failed_count = 0
    
    for idx, lighting_set in enumerate(lighting_sets):
        row_result = {
            "row": idx + 1,
            "set_code": lighting_set.set_code,
            "success": False,
            "errors": [],
            "warnings": []
        }
        
        try:
            existing_set = get_lighting_set_by_code(db, lighting_set.set_code)
            if existing_set:
                row_result["errors"].append(f"套装编号 {lighting_set.set_code} 已存在")
                failed_count += 1
                results.append(row_result)
                continue
            
            if lighting_set.status == "returned":
                original_items = lighting_set.items
                expected_categories = set()
                for item in original_items:
                    expected_categories.add(item.category)
                
                if len(original_items) < 3:
                    row_result["warnings"].append("套装设备数量少于3件，可能不成套")
                
                for item in original_items:
                    if item.status != "normal":
                        row_result["warnings"].append(
                            f"设备 {item.item_name} 状态为 {item.status}，需检查"
                        )
            
            db_set = create_lighting_set(db, lighting_set)
            row_result["success"] = True
            row_result["set_id"] = db_set.id
            row_result["completeness_score"] = db_set.completeness_score
            success_count += 1
            
        except Exception as e:
            row_result["errors"].append(str(e))
            failed_count += 1
        
        results.append(row_result)
    
    return {
        "total": len(lighting_sets),
        "success": success_count,
        "failed": failed_count,
        "results": results
    }


def return_lighting_set(
    db: Session,
    lighting_set_id: int,
    actual_return_date: Optional[datetime] = None
):
    db_set = get_lighting_set(db, lighting_set_id)
    if not db_set:
        return {"error": "套装不存在"}
    
    if db_set.status not in ["rented", "lent"]:
        return {"error": "当前状态不支持归还操作"}
    
    warnings = []
    
    if db_set.completeness_score < 100:
        warnings.append(f"套装完整性分数为 {db_set.completeness_score}%，设备可能有缺失")
    
    for item in db_set.items:
        if item.status != "normal":
            warnings.append(f"设备 {item.item_name} 状态异常: {item.condition_description or item.status}")
    
    db_set.status = "returned"
    db_set.actual_return_date = actual_return_date or datetime.now()
    
    db.commit()
    db.refresh(db_set)
    
    return {
        "message": "归还成功",
        "completeness_score": db_set.completeness_score,
        "warnings": warnings
    }
