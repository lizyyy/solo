import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from dataclasses import asdict

from .models import (
    MigrationRecord,
    IoTDeviceReceipt,
    Attachment,
    SystemJudgment,
    ManualCorrection,
    ChangeHistory,
    MaterialSummary,
    Status
)

DATA_DIR = Path.home() / ".migration_cli" / "data"
RECORDS_FILE = DATA_DIR / "migration_records.json"

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Status):
            return obj.value
        return super().default(obj)

def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def record_to_dict(record: MigrationRecord) -> Dict[str, Any]:
    data = asdict(record)
    return data

def dict_to_record(data: Dict[str, Any]) -> MigrationRecord:
    receipt_data = data["receipt"]
    receipt = IoTDeviceReceipt(
        receipt_id=receipt_data["receipt_id"],
        device_id=receipt_data["device_id"],
        device_name=receipt_data["device_name"],
        receipt_type=receipt_data["receipt_type"],
        received_date=datetime.fromisoformat(receipt_data["received_date"]),
        operator=receipt_data["operator"],
        original_input=receipt_data["original_input"],
        attachments=[
            Attachment(
                id=a["id"],
                name=a["name"],
                upload_date=datetime.fromisoformat(a["upload_date"]),
                expire_date=datetime.fromisoformat(a["expire_date"]) if a.get("expire_date") else None,
                is_expired=a["is_expired"]
            ) for a in receipt_data.get("attachments", [])
        ],
        remark=receipt_data.get("remark")
    )

    system_judgment = None
    if data.get("system_judgment"):
        sj = data["system_judgment"]
        system_judgment = SystemJudgment(
            judgment_id=sj["judgment_id"],
            receipt_id=sj["receipt_id"],
            status=Status(sj["status"]),
            issues=sj["issues"],
            judgment_time=datetime.fromisoformat(sj["judgment_time"])
        )

    manual_correction = None
    if data.get("manual_correction"):
        mc = data["manual_correction"]
        manual_correction = ManualCorrection(
            correction_id=mc["correction_id"],
            receipt_id=mc["receipt_id"],
            operator=mc["operator"],
            correction_note=mc["correction_note"],
            corrected_status=Status(mc["corrected_status"]) if mc.get("corrected_status") else None,
            correction_time=datetime.fromisoformat(mc["correction_time"])
        )

    material_summary = None
    if data.get("material_summary"):
        ms = data["material_summary"]
        material_summary = MaterialSummary(
            summary_id=ms["summary_id"],
            receipt_id=ms["receipt_id"],
            summary_text=ms["summary_text"],
            created_time=datetime.fromisoformat(ms["created_time"])
        )

    change_histories = []
    for ch in data.get("change_histories", []):
        change_histories.append(ChangeHistory(
            change_id=ch["change_id"],
            receipt_id=ch["receipt_id"],
            resource_scope=ch["resource_scope"],
            change_type=ch["change_type"],
            change_reason=ch["change_reason"],
            operator=ch["operator"],
            change_time=datetime.fromisoformat(ch["change_time"]),
            previous_value=ch.get("previous_value"),
            new_value=ch.get("new_value")
        ))

    return MigrationRecord(
        receipt=receipt,
        system_judgment=system_judgment,
        manual_correction=manual_correction,
        material_summary=material_summary,
        change_histories=change_histories
    )

def save_records(records: List[MigrationRecord]):
    ensure_data_dir()
    records_data = [record_to_dict(r) for r in records]
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(records_data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)

def load_records() -> List[MigrationRecord]:
    ensure_data_dir()
    if not RECORDS_FILE.exists():
        return []
    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        records_data = json.load(f)
    return [dict_to_record(data) for data in records_data]

def add_record(record: MigrationRecord):
    records = load_records()
    records.append(record)
    save_records(records)

def get_record_by_id(receipt_id: str) -> Optional[MigrationRecord]:
    records = load_records()
    for record in records:
        if record.receipt.receipt_id == receipt_id:
            return record
    return None

def update_record(record: MigrationRecord):
    records = load_records()
    for i, r in enumerate(records):
        if r.receipt.receipt_id == record.receipt.receipt_id:
            records[i] = record
            break
    save_records(records)
