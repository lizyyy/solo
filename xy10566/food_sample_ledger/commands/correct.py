import json
from typing import Dict, Any
from ..utils.storage import Storage
from ..services.sample_service import SampleService
from ..models import ManualCorrection


def correct_command(
    data_dir: str,
    target_type: str,
    target_id: str,
    updates: str,
    operator: str,
    correction_reason: str,
) -> Dict[str, Any]:
    storage = Storage(data_dir)
    service = SampleService(storage)

    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    try:
        updates_dict = json.loads(updates)
    except json.JSONDecodeError:
        result["success"] = False
        result["message"] = "人工修正失败"
        result["errors"].append("updates参数必须是有效的JSON格式")
        return result

    type_mapping = {
        "sample": "FoodSample",
        "dish": "Dish",
        "batch": "Batch",
        "fridge": "FridgeLocation",
        "box": "SampleBox",
        "inspection": "InspectionRecord",
    }

    if target_type not in type_mapping:
        result["success"] = False
        result["message"] = "人工修正失败"
        result["errors"].append(f"不支持的目标类型: {target_type}")
        return result

    internal_type = type_mapping[target_type]

    op_result = service.manual_correct(
        target_type=internal_type,
        target_id=target_id,
        updates=updates_dict,
        operator=operator,
        correction_reason=correction_reason,
    )

    if not op_result.success:
        result["success"] = False
        result["message"] = "人工修正失败"
        result["errors"].extend(op_result.errors)
        return result

    result["message"] = op_result.message

    if op_result.data:
        result["data"] = {
            "corrected_entity": op_result.data.to_dict(),
        }

        corrections = [
            c.to_dict() for c in storage.load_all(ManualCorrection)
            if c.target_type == internal_type and c.target_id == target_id
        ]
        if corrections:
            latest_correction = sorted(
                corrections,
                key=lambda x: x["created_at"],
                reverse=True
            )[0]
            result["data"]["correction_record"] = latest_correction

            if "before_data" in latest_correction and "after_data" in latest_correction:
                result["data"]["diff"] = {
                    "changed_fields": latest_correction.get("changed_fields", []),
                    "operator": latest_correction.get("operator"),
                    "correction_reason": latest_correction.get("correction_reason"),
                }

    return result
