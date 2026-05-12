from datetime import datetime
from typing import Dict, Any, Optional
from ..utils.storage import Storage
from ..models import (
    FoodSample,
    Dish,
    Batch,
    FridgeLocation,
    SampleBox,
    InspectionRecord,
    ManualCorrection,
)


def detail_command(data_dir: str, target_type: str, target_id: str) -> Dict[str, Any]:
    storage = Storage(data_dir)
    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    model_mapping = {
        "sample": FoodSample,
        "dish": Dish,
        "batch": Batch,
        "fridge": FridgeLocation,
        "box": SampleBox,
        "inspection": InspectionRecord,
    }

    if target_type not in model_mapping:
        result["success"] = False
        result["message"] = "查询失败"
        result["errors"].append(f"不支持的目标类型: {target_type}")
        return result

    model_class = model_mapping[target_type]
    entity = storage.load(model_class, target_id)

    if not entity:
        result["success"] = False
        result["message"] = "查询失败"
        result["errors"].append(f"目标不存在: {target_id}")
        return result

    result["data"] = {
        "type": target_type,
        "entity": entity.to_dict(),
        "related_data": {},
    }

    if target_type == "sample":
        dish = storage.load(Dish, entity.dish_id)
        batch = storage.load(Batch, entity.batch_id)
        if dish:
            result["data"]["related_data"]["dish"] = dish.to_dict()
        if batch:
            result["data"]["related_data"]["batch"] = batch.to_dict()

        inspections = [
            i.to_dict() for i in storage.load_all(InspectionRecord)
            if i.sample_id == entity.id
        ]
        if inspections:
            result["data"]["related_data"]["inspections"] = inspections

        corrections = [
            c.to_dict() for c in storage.load_all(ManualCorrection)
            if c.target_type == "FoodSample" and c.target_id == entity.id
        ]
        if corrections:
            result["data"]["related_data"]["corrections"] = corrections

        current_time = datetime.now().isoformat()
        result["data"]["status"] = {
            "current_status": entity.get_status(current_time),
            "current_time": current_time,
            "is_overdue": current_time > entity.scheduled_destruction_time,
            "is_destroyed": entity.is_destroyed,
        }

    if target_type == "dish":
        related_samples = [
            s.to_dict() for s in storage.load_all(FoodSample)
            if s.dish_id == entity.id
        ]
        if related_samples:
            result["data"]["related_data"]["samples"] = related_samples

        related_batches = [
            b.to_dict() for b in storage.load_all(Batch)
            if b.dish_id == entity.id
        ]
        if related_batches:
            result["data"]["related_data"]["batches"] = related_batches

    if target_type == "batch":
        related_samples = [
            s.to_dict() for s in storage.load_all(FoodSample)
            if s.batch_id == entity.id
        ]
        if related_samples:
            result["data"]["related_data"]["samples"] = related_samples

        if entity.is_locked:
            result["warnings"].append("该批次已被锁定")

    result["message"] = f"查询成功: {target_type} - {target_id}"
    return result
