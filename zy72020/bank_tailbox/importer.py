import csv
import io
import os
from datetime import datetime
from models import get_db

RECORD_UNIQUE_FIELDS = ["transfer_date", "from_branch", "to_branch", "voucher_no"]


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _build_unique_key(row):
    parts = []
    for f in RECORD_UNIQUE_FIELDS:
        v = row.get(f, "")
        if v is None:
            v = ""
        if not isinstance(v, str):
            v = str(v)
        v = v.strip()
        if f == "amount":
            v = str(float(v)) if v else ""
        parts.append(v)
    return "|".join(parts)


def _row_to_record(row, batch_id, source_type, source_file, is_supplement=False, supplement_batch_id=None):
    return {
        "batch_id": batch_id,
        "transfer_date": row.get("transfer_date", "").strip(),
        "from_branch": row.get("from_branch", "").strip(),
        "to_branch": row.get("to_branch", "").strip(),
        "amount": float(row.get("amount", 0)),
        "currency": row.get("currency", "CNY").strip() or "CNY",
        "operator": row.get("operator", "").strip(),
        "transfer_type": row.get("transfer_type", "").strip(),
        "approval_email_ref": row.get("approval_email_ref", "").strip(),
        "voucher_no": row.get("voucher_no", "").strip(),
        "status": "pending",
        "original_source": f"{source_type}:{os.path.basename(source_file)}" if source_file else source_type,
        "created_at": _now(),
        "updated_at": _now(),
        "is_supplement": 1 if is_supplement else 0,
        "supplement_batch_id": supplement_batch_id,
    }


def import_csv(file_path, source_type, batch_name=None, dedup_strategy="skip", is_supplement=False, supplement_batch_id=None):
    conn = get_db()
    now = _now()
    batch_name = batch_name or f"{source_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    source_file = os.path.basename(file_path)

    cursor = conn.execute(
        "INSERT INTO batch (name, source_type, source_file, import_time, notes, record_count) VALUES (?, ?, ?, ?, ?, 0)",
        (batch_name, source_type, source_file, now, ""),
    )
    batch_id = cursor.lastrowid

    result = {"batch_id": batch_id, "imported": 0, "skipped": 0, "updated": 0, "conflicts": 0, "conflict_details": []}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            record = _row_to_record(row, batch_id, source_type, source_file, is_supplement, supplement_batch_id)
            unique_key = _build_unique_key(row)

            existing = conn.execute(
                "SELECT * FROM record WHERE transfer_date=? AND from_branch=? AND to_branch=? AND (voucher_no=? OR (?='' AND voucher_no=''))",
                (record["transfer_date"], record["from_branch"], record["to_branch"], record["voucher_no"], record["voucher_no"]),
            ).fetchone()

            if existing:
                if dedup_strategy == "skip":
                    result["skipped"] += 1
                    conn.execute(
                        "INSERT INTO audit_log (record_id, action, old_value, new_value, operator, source, created_at) VALUES (?, 'skip_duplicate', ?, ?, 'system', ?, ?)",
                        (existing["id"], unique_key, unique_key, source_file, now),
                    )
                elif dedup_strategy == "update":
                    old_vals = {k: existing[k] for k in record if k not in ("batch_id", "created_at", "original_source")}
                    set_clauses = []
                    set_values = []
                    for k, v in record.items():
                        if k in ("id", "batch_id", "created_at", "original_source"):
                            continue
                        if k == "updated_at":
                            set_clauses.append(f"{k}=?")
                            set_values.append(now)
                            continue
                        old_v = str(existing[k]) if existing[k] is not None else ""
                        new_v = str(v) if v is not None else ""
                        if old_v != new_v:
                            set_clauses.append(f"{k}=?")
                            set_values.append(v)
                            conn.execute(
                                "INSERT INTO audit_log (record_id, action, old_value, new_value, operator, source, created_at) VALUES (?, 'field_update', ?, ?, 'system', ?, ?)",
                                (existing["id"], f"{k}={old_v}", f"{k}={new_v}", source_file, now),
                            )
                    if set_clauses:
                        new_source = existing["original_source"] + f";{source_type}:{source_file}"
                        set_clauses.append("original_source=?")
                        set_values.append(new_source)
                        set_values.append(existing["id"])
                        conn.execute(f"UPDATE record SET {', '.join(set_clauses)} WHERE id=?", set_values)
                    result["updated"] += 1
                elif dedup_strategy == "conflict":
                    _detect_conflicts(conn, existing, record, source_type, source_file, now, result)
            else:
                cols = ", ".join(record.keys())
                placeholders = ", ".join(["?"] * len(record))
                conn.execute(f"INSERT INTO record ({cols}) VALUES ({placeholders})", list(record.values()))
                result["imported"] += 1

    conn.execute("UPDATE batch SET record_count=? WHERE id=?", (result["imported"] + result["updated"] + result["conflicts"], batch_id))
    conn.commit()
    conn.close()
    return result


def _detect_conflicts(conn, existing, new_record, source_type, source_file, now, result):
    compare_fields = ["amount", "operator", "transfer_type", "currency"]
    found_conflict = False
    for field in compare_fields:
        old_v = str(existing[field]) if existing[field] is not None else ""
        new_v = str(new_record[field]) if new_record[field] is not None else ""
        if old_v != new_v and new_v != "":
            suggested = "manual_review"
            if field == "amount":
                suggested = "verify_with_bank_receipt"
            elif field == "operator":
                suggested = "check_approval_email"
            conn.execute(
                "INSERT INTO conflict (record_id, field_name, email_value, import_value, import_source, email_source, suggested_action, resolution, resolved_by, resolved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)",
                (
                    existing["id"],
                    field,
                    old_v,
                    new_v,
                    f"{source_type}:{source_file}",
                    existing["original_source"],
                    suggested,
                    now,
                ),
                )
            found_conflict = True

    if found_conflict:
        conn.execute("UPDATE record SET status='conflict', updated_at=? WHERE id=?", (now, existing["id"]))
        result["conflicts"] += 1
        result["conflict_details"].append(
            {
                "record_id": existing["id"],
                "transfer_date": new_record["transfer_date"],
                "from_branch": new_record["from_branch"],
                "to_branch": new_record["to_branch"],
            }
        )
    else:
        result["skipped"] += 1
        conn.execute(
            "INSERT INTO audit_log (record_id, action, old_value, new_value, operator, source, created_at) VALUES (?, 'skip_duplicate_no_conflict', ?, ?, 'system', ?, ?)",
            (existing["id"], _build_unique_key(new_record), _build_unique_key(new_record), source_file, now),
        )
