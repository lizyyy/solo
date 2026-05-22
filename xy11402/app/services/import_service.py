import json
import hashlib
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
from sqlalchemy.orm import Session
import pandas as pd

from app.models.enums import TaskSource
from app.schemas.task import ReceiptSubmitRequest, OriginalEvidenceCreate
from app.services.task_service import submit_receipt, get_task_by_idempotency_key


def generate_idempotency_key(source: str, source_file: str, row_key: str) -> str:
    key_string = f"{source}:{source_file}:{row_key}"
    return hashlib.md5(key_string.encode()).hexdigest()


def parse_excel_file(file_path: str, sheet_name: Optional[str] = None) -> pd.DataFrame:
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    return df


def parse_csv_file(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    return df


def extract_row_key(row: Dict[str, Any], key_fields: List[str]) -> str:
    key_values = []
    for field in key_fields:
        value = row.get(field, "")
        key_values.append(str(value))
    return "|".join(key_values)


def get_default_key_fields(source: TaskSource) -> List[str]:
    key_fields_map = {
        TaskSource.DRIVER_PHOTO: ["box_no", "driver_id", "photo_time"],
        TaskSource.WMS_BOX: ["box_no", "warehouse_code", "operate_time"],
        TaskSource.TEMPERATURE_RECORD: ["box_no", "record_start_time", "record_end_time"],
        TaskSource.INVENTORY_DIFF: ["box_no", "check_date", "sku_code"],
    }
    return key_fields_map.get(source, ["box_no"])


def import_data_from_file(
    db: Session,
    file_path: str,
    source: TaskSource,
    key_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    file_ext = Path(file_path).suffix.lower()

    if file_ext in [".xlsx", ".xls"]:
        df = parse_excel_file(file_path)
    elif file_ext == ".csv":
        df = parse_csv_file(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {file_ext}")

    if key_fields is None:
        key_fields = get_default_key_fields(source)

    source_file = Path(file_path).name
    created_count = 0
    skipped_count = 0
    results = []

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        row_no = idx + 2

        row_key = extract_row_key(row_dict, key_fields)
        idempotency_key = generate_idempotency_key(source, source_file, row_key)

        existing_task = get_task_by_idempotency_key(db, idempotency_key)
        if existing_task:
            skipped_count += 1
            results.append({
                "row_no": row_no,
                "task_no": existing_task.task_no,
                "status": "skipped",
                "message": "任务已存在",
            })
            continue

        box_no = str(row_dict.get("box_no", ""))
        driver_id = str(row_dict.get("driver_id", "")) if pd.notna(row_dict.get("driver_id")) else None
        temperature_record_id = (
            str(row_dict.get("temperature_record_id", ""))
            if pd.notna(row_dict.get("temperature_record_id"))
            else None
        )
        compensation_amount = float(row_dict.get("compensation_amount", 0) or 0)

        parsed_data = {k: v for k, v in row_dict.items() if pd.notna(v)}

        request = ReceiptSubmitRequest(
            idempotency_key=idempotency_key,
            source=source,
            source_file=source_file,
            source_row_no=row_no,
            box_no=box_no,
            driver_id=driver_id,
            temperature_record_id=temperature_record_id,
            original_data=row_dict,
            parsed_data=parsed_data,
            compensation_amount=compensation_amount,
        )

        task, created = submit_receipt(db, request)

        if created:
            created_count += 1
            results.append({
                "row_no": row_no,
                "task_no": task.task_no,
                "status": "created",
                "message": "任务创建成功",
            })
        else:
            skipped_count += 1
            results.append({
                "row_no": row_no,
                "task_no": task.task_no,
                "status": "skipped",
                "message": "任务已存在",
            })

    return {
        "source_file": source_file,
        "source": source,
        "total_rows": len(df),
        "created_count": created_count,
        "skipped_count": skipped_count,
        "results": results,
    }


def import_json_data(
    db: Session,
    data: List[Dict[str, Any]],
    source: TaskSource,
    source_file: str,
    key_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if key_fields is None:
        key_fields = get_default_key_fields(source)

    created_count = 0
    skipped_count = 0
    results = []

    for idx, item in enumerate(data):
        row_no = idx + 1
        row_key = extract_row_key(item, key_fields)
        idempotency_key = generate_idempotency_key(source, source_file, row_key)

        existing_task = get_task_by_idempotency_key(db, idempotency_key)
        if existing_task:
            skipped_count += 1
            results.append({
                "row_no": row_no,
                "task_no": existing_task.task_no,
                "status": "skipped",
                "message": "任务已存在",
            })
            continue

        box_no = str(item.get("box_no", ""))
        driver_id = item.get("driver_id")
        temperature_record_id = item.get("temperature_record_id")
        compensation_amount = float(item.get("compensation_amount", 0) or 0)

        request = ReceiptSubmitRequest(
            idempotency_key=idempotency_key,
            source=source,
            source_file=source_file,
            source_row_no=row_no,
            box_no=box_no,
            driver_id=driver_id,
            temperature_record_id=temperature_record_id,
            original_data=item,
            parsed_data=item,
            compensation_amount=compensation_amount,
        )

        task, created = submit_receipt(db, request)

        if created:
            created_count += 1
            results.append({
                "row_no": row_no,
                "task_no": task.task_no,
                "status": "created",
                "message": "任务创建成功",
            })
        else:
            skipped_count += 1
            results.append({
                "row_no": row_no,
                "task_no": task.task_no,
                "status": "skipped",
                "message": "任务已存在",
            })

    return {
        "source_file": source_file,
        "source": source,
        "total_rows": len(data),
        "created_count": created_count,
        "skipped_count": skipped_count,
        "results": results,
    }
