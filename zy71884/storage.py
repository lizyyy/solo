import json
import os
import hashlib
from datetime import datetime
from typing import Optional, List
from dataclasses import asdict

from models import (
    MaterialBatch, SensorLog, CalibrationResult,
    Status, MeasurementMethod, AnomalyMark, AnomalyType,
    JudgmentTrail
)


STORAGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
BATCH_INDEX_FILE = os.path.join(STORAGE_DIR, "batch_index.json")


def _ensure_storage_dir():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)


def _get_batch_file_path(batch_id: str) -> str:
    return os.path.join(STORAGE_DIR, f"batch_{batch_id}.json")


def _load_batch_index() -> dict:
    _ensure_storage_dir()
    if os.path.exists(BATCH_INDEX_FILE):
        with open(BATCH_INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"batches": {}}


def _save_batch_index(index: dict):
    _ensure_storage_dir()
    with open(BATCH_INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def compute_data_hash(raw_data: List[dict]) -> str:
    data_str = json.dumps(raw_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()[:16]


def batch_exists(batch_id: str) -> bool:
    index = _load_batch_index()
    return batch_id in index["batches"]


def get_batch(batch_id: str) -> Optional[MaterialBatch]:
    if not batch_exists(batch_id):
        return None

    file_path = _get_batch_file_path(batch_id)
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logs = [SensorLog(**log) for log in data["logs"]]
    records = []
    for rec in data["calibration_records"]:
        rec["method"] = MeasurementMethod(rec["method"])
        rec["status"] = Status(rec["status"])

        anomalies = []
        for a in rec.get("anomalies", []):
            a["anomaly_type"] = AnomalyType(a["anomaly_type"])
            anomalies.append(AnomalyMark(**a))
        rec["anomalies"] = anomalies

        trails = []
        for t in rec.get("judgment_trails", []):
            trails.append(JudgmentTrail(**t))
        rec["judgment_trails"] = trails

        records.append(CalibrationResult(**rec))

    return MaterialBatch(
        batch_id=data["batch_id"],
        material_name=data["material_name"],
        student_name=data["student_name"],
        student_id=data["student_id"],
        experiment_date=data["experiment_date"],
        created_at=data["created_at"],
        logs=logs,
        calibration_records=records,
        latest_status=Status(data["latest_status"])
    )


def create_batch(
    batch_id: str,
    material_name: str,
    student_name: str,
    student_id: str,
    experiment_date: str
) -> MaterialBatch:
    _ensure_storage_dir()

    if batch_exists(batch_id):
        raise ValueError(f"批次 {batch_id} 已存在，无法创建。如需更新请使用 add_sensor_log 追加新版本。")

    batch = MaterialBatch(
        batch_id=batch_id,
        material_name=material_name,
        student_name=student_name,
        student_id=student_id,
        experiment_date=experiment_date,
        created_at=datetime.now().isoformat(timespec="seconds")
    )

    _save_batch(batch)

    index = _load_batch_index()
    index["batches"][batch_id] = {
        "batch_id": batch_id,
        "student_name": student_name,
        "student_id": student_id,
        "experiment_date": experiment_date,
        "created_at": batch.created_at,
        "latest_status": batch.latest_status.value,
        "log_versions": len(batch.logs)
    }
    _save_batch_index(index)

    return batch


def _save_batch(batch: MaterialBatch):
    file_path = _get_batch_file_path(batch.batch_id)
    data = asdict(batch)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def add_sensor_log(
    batch_id: str,
    raw_data: List[dict],
    filename: str
) -> tuple[MaterialBatch, int, bool]:
    if not batch_exists(batch_id):
        raise ValueError(f"批次 {batch_id} 不存在，请先创建批次。")

    batch = get_batch(batch_id)
    data_hash = compute_data_hash(raw_data)

    for existing_log in batch.logs:
        if existing_log.data_hash == data_hash:
            return batch, existing_log.version, False

    new_version = len(batch.logs) + 1
    new_log = SensorLog(
        version=new_version,
        upload_time=datetime.now().isoformat(timespec="seconds"),
        filename=filename,
        raw_data=raw_data,
        data_hash=data_hash
    )

    batch.logs.append(new_log)
    _save_batch(batch)

    index = _load_batch_index()
    index["batches"][batch_id]["log_versions"] = len(batch.logs)
    _save_batch_index(index)

    return batch, new_version, True


def add_calibration_record(batch_id: str, record: CalibrationResult):
    if not batch_exists(batch_id):
        raise ValueError(f"批次 {batch_id} 不存在。")

    batch = get_batch(batch_id)
    batch.calibration_records.append(record)

    if batch.latest_status == Status.NORMAL and record.status != Status.NORMAL:
        batch.latest_status = record.status
    elif batch.latest_status == Status.PENDING:
        batch.latest_status = record.status

    _save_batch(batch)

    index = _load_batch_index()
    index["batches"][batch_id]["latest_status"] = batch.latest_status.value
    _save_batch_index(index)


def list_all_batches() -> List[dict]:
    index = _load_batch_index()
    return list(index["batches"].values())


def get_latest_log(batch_id: str) -> Optional[SensorLog]:
    batch = get_batch(batch_id)
    if not batch or not batch.logs:
        return None
    return batch.logs[-1]


def get_log_by_version(batch_id: str, version: int) -> Optional[SensorLog]:
    batch = get_batch(batch_id)
    if not batch:
        return None
    for log in batch.logs:
        if log.version == version:
            return log
    return None
