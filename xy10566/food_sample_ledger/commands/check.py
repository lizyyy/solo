from datetime import datetime
from typing import Dict, Any
from ..utils.storage import Storage
from ..services.sample_service import SampleService
from ..models import FoodSample, InspectionRecord, Batch, ManualCorrection


def check_command(data_dir: str, show_details: bool = False) -> Dict[str, Any]:
    storage = Storage(data_dir)
    service = SampleService(storage)

    current_time = datetime.now().isoformat()
    status = service.check_all_status()

    samples = storage.load_all(FoodSample)
    inspections = storage.load_all(InspectionRecord)
    batches = storage.load_all(Batch)
    corrections = storage.load_all(ManualCorrection)

    anomalies = {
        "overdue_samples": [],
        "locked_batches": [],
        "abnormal_inspections": [],
        "weight_insufficient_samples": [],
        "duplicate_samples": [],
        "pending_follow_up": [],
    }

    for sample in samples:
        if not sample.is_destroyed:
            if current_time > sample.scheduled_destruction_time:
                anomalies["overdue_samples"].append({
                    "id": sample.id,
                    "dish_name": sample.dish_name,
                    "batch_number": sample.batch_number,
                    "scheduled_destruction": sample.scheduled_destruction_time,
                    "current_time": current_time,
                })
            if sample.sample_weight < 200.0:
                anomalies["weight_insufficient_samples"].append({
                    "id": sample.id,
                    "dish_name": sample.dish_name,
                    "sample_weight": sample.sample_weight,
                    "required_weight": 200.0,
                })

    for batch in batches:
        if batch.is_locked:
            anomalies["locked_batches"].append({
                "id": batch.id,
                "batch_number": batch.batch_number,
                "dish_name": batch.dish_name,
                "lock_reason": batch.lock_reason,
                "locked_at": batch.locked_at,
            })

    for inspection in inspections:
        if inspection.is_abnormal:
            anomalies["abnormal_inspections"].append({
                "id": inspection.id,
                "dish_name": inspection.dish_name,
                "batch_number": inspection.batch_number,
                "result": inspection.result,
                "abnormal_details": inspection.abnormal_details,
                "inspection_time": inspection.inspection_time,
                "inspector": inspection.inspector,
            })

    for inspection in inspections:
        if inspection.follow_up_required and not inspection.follow_up_completed:
            anomalies["pending_follow_up"].append({
                "id": inspection.id,
                "dish_name": inspection.dish_name,
                "batch_number": inspection.batch_number,
                "inspection_type": inspection.inspection_type,
            })

    result = {
        "success": True,
        "message": "",
        "data": {},
        "errors": [],
        "warnings": [],
    }

    result["data"] = {
        "current_time": current_time,
        "summary": status["summary"],
        "anomalies_count": {
            "overdue": len(anomalies["overdue_samples"]),
            "locked_batches": len(anomalies["locked_batches"]),
            "abnormal_inspections": len(anomalies["abnormal_inspections"]),
            "weight_insufficient": len(anomalies["weight_insufficient_samples"]),
            "pending_follow_up": len(anomalies["pending_follow_up"]),
        },
        "history": {
            "corrections_count": len(corrections),
            "inspections_count": len(inspections),
            "samples_count": len(samples),
        },
    }

    if show_details:
        result["data"]["anomalies_details"] = anomalies

    anomaly_count = sum(result["data"]["anomalies_count"].values())
    if anomaly_count > 0:
        result["message"] = f"检查完成，发现 {anomaly_count} 个异常项"
        result["warnings"].append(f"请关注 {anomaly_count} 个异常项需要处理")
    else:
        result["message"] = "检查完成，无异常"

    anomalies_list = []
    if result["data"]["anomalies_count"]["overdue"] > 0:
        anomalies_list.append(f"{result['data']['anomalies_count']['overdue']}个留样超期")
    if result["data"]["anomalies_count"]["locked_batches"] > 0:
        anomalies_list.append(f"{result['data']['anomalies_count']['locked_batches']}个批次锁定")
    if result["data"]["anomalies_count"]["abnormal_inspections"] > 0:
        anomalies_list.append(f"{result['data']['anomalies_count']['abnormal_inspections']}个抽检异常")
    if result["data"]["anomalies_count"]["weight_insufficient"] > 0:
        anomalies_list.append(f"{result['data']['anomalies_count']['weight_insufficient']}个重量不足")

    if anomalies_list:
        result["message"] += f"（{', '.join(anomalies_list)}）"

    return result
