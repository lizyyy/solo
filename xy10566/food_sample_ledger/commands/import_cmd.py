import json
import os
from typing import Dict, Any, List
from ..models import (
    Dish,
    Batch,
    FridgeLocation,
    SampleBox,
    FoodSample,
    InspectionRecord,
    DailyMenu,
)
from ..utils.storage import Storage
from ..services.sample_service import SampleService


def import_command(data_dir: str, import_file: str) -> Dict[str, Any]:
    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    if not os.path.exists(import_file):
        result["success"] = False
        result["message"] = "导入失败"
        result["errors"].append(f"导入文件不存在: {import_file}")
        return result

    try:
        with open(import_file, "r", encoding="utf-8") as f:
            import_data = json.load(f)
    except json.JSONDecodeError as e:
        result["success"] = False
        result["message"] = "导入失败"
        result["errors"].append(f"JSON解析错误: {str(e)}")
        return result

    storage = Storage(data_dir)
    service = SampleService(storage)

    imported = {
        "dishes": 0,
        "batches": 0,
        "fridge_locations": 0,
        "sample_boxes": 0,
        "samples": 0,
        "inspections": 0,
        "daily_menus": 0,
    }

    if "dishes" in import_data:
        for dish_data in import_data["dishes"]:
            existing_dishes = storage.load_all(Dish)
            if any(d.name == dish_data.get("name") for d in existing_dishes):
                result["warnings"].append(f"菜品已存在，跳过: {dish_data.get('name')}")
                continue
            dish = Dish(**dish_data)
            storage.save(dish)
            imported["dishes"] += 1

    if "batches" in import_data:
        for batch_data in import_data["batches"]:
            existing_batches = storage.load_all(Batch)
            if any(b.batch_number == batch_data.get("batch_number") for b in existing_batches):
                result["warnings"].append(f"批次已存在，跳过: {batch_data.get('batch_number')}")
                continue
            batch = Batch(**batch_data)
            storage.save(batch)
            imported["batches"] += 1

    if "fridge_locations" in import_data:
        for fridge_data in import_data["fridge_locations"]:
            fridge = FridgeLocation(**fridge_data)
            storage.save(fridge)
            imported["fridge_locations"] += 1

    if "sample_boxes" in import_data:
        for box_data in import_data["sample_boxes"]:
            existing_boxes = storage.load_all(SampleBox)
            if any(sb.box_code == box_data.get("box_code") for sb in existing_boxes):
                result["warnings"].append(f"留样盒已存在，跳过: {box_data.get('box_code')}")
                continue
            box = SampleBox(**box_data)
            storage.save(box)
            imported["sample_boxes"] += 1

    if "daily_menus" in import_data:
        for menu_data in import_data["daily_menus"]:
            menu = DailyMenu(**menu_data)
            storage.save(menu)
            imported["daily_menus"] += 1

    if "samples" in import_data:
        for sample_data in import_data["samples"]:
            op_result = service.create_sample(
                dish_id=sample_data["dish_id"],
                batch_id=sample_data["batch_id"],
                sample_weight=sample_data["sample_weight"],
                sample_box_code=sample_data["sample_box_code"],
                fridge_location_id=sample_data["fridge_location_id"],
                sampler=sample_data.get("sampler", "系统导入"),
                sampling_time=sample_data.get("sampling_time"),
                retention_period_hours=sample_data.get("retention_period_hours"),
                notes=sample_data.get("notes"),
            )
            if op_result.success:
                imported["samples"] += 1
            else:
                result["errors"].extend(op_result.errors)

    if "inspections" in import_data:
        for inspection_data in import_data["inspections"]:
            op_result = service.create_inspection(
                sample_id=inspection_data["sample_id"],
                inspector=inspection_data.get("inspector", "系统导入"),
                result=inspection_data.get("result", "正常"),
                is_abnormal=inspection_data.get("is_abnormal", False),
                abnormal_details=inspection_data.get("abnormal_details"),
                inspection_type=inspection_data.get("inspection_type", "常规抽检"),
                corrective_actions=inspection_data.get("corrective_actions"),
                follow_up_required=inspection_data.get("follow_up_required", False),
            )
            if op_result.success:
                imported["inspections"] += 1
            else:
                result["errors"].extend(op_result.errors)

    result["data"]["imported"] = imported
    total_imported = sum(imported.values())
    result["message"] = f"导入完成，共导入 {total_imported} 条记录"

    if result["errors"]:
        result["success"] = False
        result["message"] += "（部分失败）"

    return result
