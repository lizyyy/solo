import hashlib
import datetime
from typing import List, Tuple
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
        if field_name == "temperature_value":
            old_norm = str(old_value).strip()
            new_norm = str(new_value).strip()
            old_norm = "0.0" if old_norm == "" else old_norm
            new_norm = "0.0" if new_norm == "" else new_norm
            try:
                if float(old_norm) != float(new_norm):
                    changes.append((field_name, str(old_value), str(new_value)))
            except ValueError:
                if old_norm != new_norm:
                    changes.append((field_name, str(old_value), str(new_value)))
        else:
            if str(old_value) != str(new_value):
                changes.append((field_name, str(old_value), str(new_value)))
    return changes


def import_records(
    db: Database,
    records: List[dict],
    source_file: str = "",
    operator: str = "system",
) -> Tuple[int, int, int, List[dict]]:
    batch_hash = compute_batch_hash(records)
    existing_batch = db.get_batch_by_hash(batch_hash)
    if existing_batch is not None:
        details = []
        existing_records = db.get_records_by_batch(existing_batch.id)
        record_map = {r.original_line_no: r for r in existing_records}
        for rec in records:
            line_no = rec.get("original_line_no", 0)
            existing_rec = record_map.get(line_no)
            details.append({
                "original_line_no": line_no,
                "action": "duplicate_exact",
                "record_id": existing_rec.id if existing_rec else 0,
                "changes": [],
            })
        return (existing_batch.id, 0, 0, details)

    batch = CalibrationBatch(
        batch_hash=batch_hash,
        source_file=source_file,
        record_count=len(records),
    )
    batch_id = db.insert_batch(batch)

    created_count = 0
    details = []
    for rec in records:
        temp_val_raw = rec.get("temperature_value", "")
        if isinstance(temp_val_raw, str) and temp_val_raw.strip() == "":
            temp_val = 0.0
        else:
            temp_val = float(temp_val_raw if temp_val_raw != "" else 0)
        record = TemperatureRecord(
            batch_id=batch_id,
            original_line_no=rec.get("original_line_no", 0),
            sensor_id=rec.get("sensor_id", ""),
            equipment_position=rec.get("equipment_position", ""),
            temperature_value=temp_val,
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

        details.append({
            "original_line_no": rec.get("original_line_no", 0),
            "action": "new",
            "record_id": record_id,
            "changes": [],
        })

    return (batch_id, created_count, 0, details)


def reimport_records(
    db: Database,
    target_batch_id: int,
    records: List[dict],
    source_file: str = "",
    operator: str = "system",
    reason: str = "补录返工",
) -> Tuple[int, int, int, List[dict]]:
    batch_exists = db._conn.execute("SELECT 1 FROM calibration_batch WHERE id = ?", (target_batch_id,)).fetchone()
    if batch_exists is None:
        raise ValueError(f"target_batch_id {target_batch_id} does not exist")

    created_count = 0
    updated_count = 0
    details = []

    for rec in records:
        line_no = rec.get("original_line_no", 0)
        existing = db.get_record_by_batch_and_line(target_batch_id, line_no)

        temp_val_raw = rec.get("temperature_value", "")
        if isinstance(temp_val_raw, str) and temp_val_raw.strip() == "":
            temp_val = 0.0
        else:
            temp_val = float(temp_val_raw if temp_val_raw != "" else 0)

        new_data = {
            "sensor_id": rec.get("sensor_id", ""),
            "equipment_position": rec.get("equipment_position", ""),
            "temperature_value": str(temp_val_raw if temp_val_raw != "" else "0.0"),
            "caliber": rec.get("caliber", ""),
            "remark": rec.get("remark", ""),
        }

        if existing is None:
            record = TemperatureRecord(
                batch_id=target_batch_id,
                original_line_no=line_no,
                sensor_id=rec.get("sensor_id", ""),
                equipment_position=rec.get("equipment_position", ""),
                temperature_value=temp_val,
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
                reason=reason,
            )
            db.insert_change_history(ch)

            details.append({
                "original_line_no": line_no,
                "action": "new_in_batch",
                "record_id": record_id,
                "changes": [],
            })
        else:
            changes = _detect_field_changes(existing, new_data)
            if not changes:
                details.append({
                    "original_line_no": line_no,
                    "action": "unchanged",
                    "record_id": existing.id,
                    "changes": [],
                })
            else:
                existing.sensor_id = new_data["sensor_id"]
                existing.equipment_position = new_data["equipment_position"]
                existing.temperature_value = temp_val
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
                        reason=reason,
                    )
                    db.insert_change_history(ch)

                details.append({
                    "original_line_no": line_no,
                    "action": "updated",
                    "record_id": existing.id,
                    "changes": changes,
                })

    return (target_batch_id, created_count, updated_count, details)


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
