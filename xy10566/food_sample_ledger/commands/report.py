from datetime import datetime
from typing import Dict, Any
from ..utils.storage import Storage
from ..services.sample_service import SampleService
from ..models import (
    FoodSample,
    Dish,
    Batch,
    InspectionRecord,
    ManualCorrection,
    DailyMenu,
)


def report_command(data_dir: str, report_type: str = "summary" ) -> Dict[str, Any]:
    storage = Storage(data_dir)
    service = SampleService(storage)

    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    current_time = datetime.now().isoformat()
    status = service.check_all_status()

    dishes = storage.load_all(Dish)
    batches = storage.load_all(Batch)
    samples = storage.load_all(FoodSample)
    inspections = storage.load_all(InspectionRecord)
    corrections = storage.load_all(ManualCorrection)
    menus = storage.load_all(DailyMenu)

    meal_type_summary = {}
    for dish in dishes:
        if dish.meal_type not in meal_type_summary:
            meal_type_summary[dish.meal_type] = {
                "dishes_count": 0,
                "samples_count": 0,
                "responsible_persons": set(),
            }
        meal_type_summary[dish.meal_type]["dishes_count"] += 1
        meal_type_summary[dish.meal_type]["responsible_persons"].add(dish.responsible_person)

    for sample in samples:
        dish = next((d for d in dishes if d.id == sample.dish_id), None)
        if dish:
            meal_type_summary[dish.meal_type]["samples_count"] += 1

    for mt in meal_type_summary:
        meal_type_summary[mt]["responsible_persons"] = list(meal_type_summary[mt]["responsible_persons"])

    active_samples = [s for s in samples if not s.is_destroyed]
    destroyed_samples = [s for s in samples if s.is_destroyed]
    overdue_samples = [
        s for s in active_samples
        if current_time > s.scheduled_destruction_time
    ]
    normal_samples = [
        s for s in active_samples
        if current_time <= s.scheduled_destruction_time
    ]

    abnormal_inspections = [i for i in inspections if i.is_abnormal]
    locked_batches = [b for b in batches if b.is_locked]
    pending_follow_up = [
        i for i in inspections
        if i.follow_up_required and not i.follow_up_completed
    ]

    responsible_persons_data = {}
    for dish in dishes:
        if dish.responsible_person not in responsible_persons_data:
            responsible_persons_data[dish.responsible_person] = {
                "name": dish.responsible_person,
                "dishes_responsible": [],
                "samples_count": 0,
                "active_samples": 0,
                "overdue_samples": 0,
                "abnormal_inspections": 0,
            }
        responsible_persons_data[dish.responsible_person]["dishes_responsible"].append(dish.name)

    for sample in samples:
        dish = next((d for d in dishes if d.id == sample.dish_id), None)
        if dish and dish.responsible_person in responsible_persons_data:
            person_data = responsible_persons_data[dish.responsible_person]
            person_data["samples_count"] += 1
            if not sample.is_destroyed:
                person_data["active_samples"] += 1
            if current_time > sample.scheduled_destruction_time:
                person_data["overdue_samples"] += 1

    for inspection in abnormal_inspections:
        dish = next((d for d in dishes if d.name == inspection.dish_name), None)
        if dish and dish.responsible_person in responsible_persons_data:
            responsible_persons_data[dish.responsible_person]["abnormal_inspections"] += 1

    report_data = {
        "report_generated_at": current_time,
        "current_status": status["summary"],
        "meal_types": meal_type_summary,
        "responsible_persons": list(responsible_persons_data.values()),
        "sample_status": {
            "active": len(active_samples),
            "destroyed": len(destroyed_samples),
            "overdue": len(overdue_samples),
            "normal": len(normal_samples),
        },
        "inspection_summary": {
            "total": len(inspections),
            "abnormal": len(abnormal_inspections),
            "pending_follow_up": len(pending_follow_up),
        },
        "batch_status": {
            "total": len(batches),
            "locked": len(locked_batches),
        },
        "manual_corrections": {
            "total": len(corrections),
        },
        "daily_menus_count": len(menus),
    }

    if report_type == "full":
        report_data["details"] = {
            "overdue_samples": [
                {
                    "id": s.id,
                    "dish_name": s.dish_name,
                    "batch_number": s.batch_number,
                    "scheduled_destruction": s.scheduled_destruction_time,
                }
                for s in overdue_samples
            ],
            "locked_batches": [
                {
                    "id": b.id,
                    "batch_number": b.batch_number,
                    "dish_name": b.dish_name,
                    "lock_reason": b.lock_reason,
                }
                for b in locked_batches
            ],
            "abnormal_inspections": [
                {
                    "id": i.id,
                    "dish_name": i.dish_name,
                    "batch_number": i.batch_number,
                    "abnormal_details": i.abnormal_details,
                    "inspector": i.inspector,
                }
                for i in abnormal_inspections
            ],
        }

    result["data"] = report_data

    anomaly_summary = []
    if report_data["sample_status"]["overdue"] > 0:
        anomaly_summary.append(f"超期留样：{report_data['sample_status']['overdue']}个")
    if report_data["batch_status"]["locked"] > 0:
        anomaly_summary.append(f"锁定批次：{report_data['batch_status']['locked']}个")
    if report_data["inspection_summary"]["abnormal"] > 0:
        anomaly_summary.append(f"异常抽检：{report_data['inspection_summary']['abnormal']}个")
    if report_data["inspection_summary"]["pending_follow_up"] > 0:
        anomaly_summary.append(f"待跟进：{report_data['inspection_summary']['pending_follow_up']}个")

    if anomaly_summary:
        result["message"] = f"报告生成完成。注意：{', '.join(anomaly_summary)}"
        result["warnings"].extend(anomaly_summary)
    else:
        result["message"] = "报告生成完成，业务状态正常"

    return result
