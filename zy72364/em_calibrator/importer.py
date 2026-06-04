import hashlib
import datetime
from typing import List, Tuple, Optional
from .db import Database
from .models import CalibrationBatch, ChangeHistory, ChangeType, TemperatureRecord, RecordStatus


def compute_batch_hash(records: List[dict]) -> str:
    canonical_lines = []
    for rec in sorted(records, key=lambda r: r.get("original_line_no", 0)):
        line = "|".join([
            str(rec.get("original_line_no", "")),
            str(rec.get("sensor_id", "")),
            str(rec.get("equipment_position", "")),
            str(rec.get("temperature_value", "")),
            str(rec.get("caliber", "")),
            str(rec.get("remark", "")),
        ])
        canonical_lines.append(line)
    canonical = "\n".join(canonical_lines)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _record_to_dict(rec: TemperatureRecord) -> dict:
    return {
        "sensor_id": rec.sensor_id,
        "equipment_position": rec.equipment_position,
        "temperature_value": str(rec.temperature_value),
        "caliber": rec.caliber,
        "remark": rec.remark,
    }


def _detect_field_changes(existing: TemperatureRecord, new_data: dict) -> List[Tuple[str, str, str]]:
    existing_dict = _record_to_dict(existing)
    changes = []
    for field_name, new_value in new_data.items():
        if field_name not in existing_dict:
            continue
        old_value = existing_dict[field_name]
        if str(old_value) != str(new_value):
            changes.append((field_name, str(old_value), str(new_value)))
    return changes


def import_records(
    db: Database,
    records: List[dict],
    source_file: str = "",
    operator: str = "system",
) -> Tuple[int, int, int]:
    batch_hash = compute_batch_hash(records)
    existing_batch = db.get_batch_by_hash(batch_hash)
    if existing_batch is not None:
        return (existing_batch.id, 0, 0)

    batch = CalibrationBatch(
        batch_hash=batch_hash,
        source_file=source_file,
        record_count=len(records),
    )
    batch_id = db.insert_batch(batch)

    created_count = 0
    for rec in records:
        record = TemperatureRecord(
            batch_id=batch_id,
            original_line_no=rec.get("original_line_no", 0),
            sensor_id=rec.get("sensor_id", ""),
            equipment_position=rec.get("equipment_position", ""),
            temperature_value=float(rec.get("temperature_value", 0)),
            caliber=rec.get("caliber", ""),
            remark=rec.get("remark", ""),
            status=RecordStatus.IMPORTED.value,
        )
        record_id = db.insert_record(record)
        created_count += 1

        ch = ChangeHistory(
            record_id=record_id,
            change_type=ChangeType.IMPORT.value,
            field_name="*",
            old_value="",
            new_value="imported",
            changed_by=operator,
            reason="initial import",
        )
        db.insert_change_history(ch)

    return (batch_id, created_count, 0)


def reimport_records(
    db: Database,
    records: List[dict],
    source_file: str = "",
    operator: str = "system",
) -> Tuple[int, int, int]:
    batch_hash = compute_batch_hash(records)
    existing_batch = db.get_batch_by_hash(batch_hash)
    if existing_batch is not None:
        return (existing_batch.id, 0, 0)

    batch = CalibrationBatch(
        batch_hash=batch_hash,
        source_file=source_file,
        record_count=len(records),
    )
    batch_id = db.insert_batch(batch)

    created_count = 0
    updated_count = 0
    for rec in records:
        line_no = rec.get("original_line_no", 0)
        position = rec.get("equipment_position", "")
        existing = db.get_record_by_batch_and_line(batch_id, line_no)

        if existing is None:
            prev_record = db.get_latest_record_for_position(position)
            record = TemperatureRecord(
                batch_id=batch_id,
                original_line_no=line_no,
                sensor_id=rec.get("sensor_id", ""),
                equipment_position=rec.get("equipment_position", ""),
                temperature_value=float(rec.get("temperature_value", 0)),
                caliber=rec.get("caliber", ""),
                remark=rec.get("remark", ""),
                status=RecordStatus.IMPORTED.value,
            )
            record_id = db.insert_record(record)
            created_count += 1
            ch = ChangeHistory(
                record_id=record_id,
                change_type=ChangeType.IMPORT.value,
                field_name="*",
                old_value="",
                new_value="imported",
                changed_by=operator,
                reason="new record in re-import",
            )
            db.insert_change_history(ch)

            if prev_record is not None:
                new_data = {
                    "sensor_id": rec.get("sensor_id", ""),
                    "equipment_position": rec.get("equipment_position", ""),
                    "temperature_value": str(rec.get("temperature_value", "")),
                    "caliber": rec.get("caliber", ""),
                    "remark": rec.get("remark", ""),
                }
                changes = _detect_field_changes(prev_record, new_data)
                if changes:
                    updated_count += 1
                    for field_name, old_val, new_val in changes:
                        ch = ChangeHistory(
                            record_id=record_id,
                            change_type=ChangeType.MANUAL_EDIT.value,
                            field_name=field_name,
                            old_value=old_val,
                            new_value=new_val,
                            changed_by=operator,
                            reason="field change detected on re-import",
                        )
                        db.insert_change_history(ch)
        else:
            new_data = {
                "sensor_id": rec.get("sensor_id", ""),
                "equipment_position": rec.get("equipment_position", ""),
                "temperature_value": str(rec.get("temperature_value", "")),
                "caliber": rec.get("caliber", ""),
                "remark": rec.get("remark", ""),
            }
            changes = _detect_field_changes(existing, new_data)
            if changes:
                existing.sensor_id = new_data["sensor_id"]
                existing.equipment_position = new_data["equipment_position"]
                existing.temperature_value = float(new_data["temperature_value"])
                existing.caliber = new_data["caliber"]
                existing.remark = new_data["remark"]
                existing.updated_at = datetime.datetime.now().isoformat()
                db.update_record(existing)
                updated_count += 1

                for field_name, old_val, new_val in changes:
                    ch = ChangeHistory(
                        record_id=existing.id,
                        change_type=ChangeType.MANUAL_EDIT.value,
                        field_name=field_name,
                        old_value=old_val,
                        new_value=new_val,
                        changed_by=operator,
                        reason="field change detected on re-import",
                    )
                    db.insert_change_history(ch)

    return (batch_id, created_count, updated_count)


def get_record_with_evidence(db: Database, record_id: int) -> dict:
    rec = db.get_record(record_id)
    if rec is None:
        return {}
    history = db.get_change_history(record_id)
    return {
        "record": rec,
        "change_history": history,
        "original_line_no": rec.original_line_no,
        "current_status": rec.status,
    }
