import os
import json
from datetime import datetime
from ..utils.storage import Storage
from ..data.sample_data import populate_sample_data


def init_command(data_dir: str = "./data", with_samples: bool = False, include_overdue: bool = False) -> dict:
    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    if os.path.exists(data_dir) and os.listdir(data_dir):
        config_file = os.path.join(data_dir, "config.json")
        if os.path.exists(config_file):
            result["success"] = True
            result["message"] = "仓库已初始化（幂等处理），无需重复操作"
            result["warnings"].append("数据目录已存在且已配置")
            with open(config_file, "r", encoding="utf-8") as f:
                result["data"]["existing_config"] = json.load(f)
            return result

    storage = Storage(data_dir)

    config = {
        "init_time": datetime.now().isoformat(),
        "data_dir": data_dir,
        "version": "1.0.0",
        "retention_period_hours": 48,
        "min_sample_weight": 200.0,
    }

    config_file = os.path.join(data_dir, "config.json")
    with open(config_file, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    result["data"]["config"] = config
    result["data"]["directories"] = {
        "dishes": os.path.join(data_dir, "dishes"),
        "batches": os.path.join(data_dir, "batches"),
        "fridges": os.path.join(data_dir, "fridges"),
        "sample_boxes": os.path.join(data_dir, "sample_boxes"),
        "samples": os.path.join(data_dir, "samples"),
        "inspections": os.path.join(data_dir, "inspections"),
        "corrections": os.path.join(data_dir, "corrections"),
        "daily_menus": os.path.join(data_dir, "daily_menus"),
    }

    if with_samples:
        sample_data = populate_sample_data(storage, include_overdue_sample=include_overdue)
        result["data"]["sample_data"] = {
            "dishes_count": len(sample_data["dishes"]),
            "batches_count": len(sample_data["batches"]),
            "fridge_locations_count": len(sample_data["fridge_locations"]),
            "sample_boxes_count": len(sample_data["sample_boxes"]),
            "menus_count": len(sample_data["menus"]),
            "samples_count": len(sample_data["samples"]),
            "sample_dishes": [d.name for d in sample_data["dishes"]],
            "meal_types": list(set(d.meal_type for d in sample_data["dishes"])),
        }
        result["message"] = f"仓库初始化成功，已加载{len(sample_data['samples'])}条样例数据（早餐、午餐、晚餐）"
    else:
        result["message"] = "仓库初始化成功，空仓库已创建"

    return result
