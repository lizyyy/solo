import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .db import get_conn


@dataclass
class ImportResult:
    total: int = 0
    inserted: int = 0
    versioned: int = 0
    skipped: int = 0
    failed: int = 0
    errors: List[str] = field(default_factory=list)
    imported_ids: List[Tuple[str, int]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "inserted": self.inserted,
            "versioned": self.versioned,
            "skipped": self.skipped,
            "failed": self.failed,
            "errors": self.errors,
            "imported_ids": [
                {"record_id": rid, "version": ver} for rid, ver in self.imported_ids
            ],
        }


def _validate_record(rec: Dict[str, Any]) -> Optional[str]:
    required = ["record_id", "pet_name", "owner_name", "training_date", "course_type"]
    for k in required:
        if not rec.get(k):
            return f"缺少必填字段: {k}"
    return None


def _get_next_version(conn, record_id: str) -> Tuple[bool, int]:
    cur = conn.execute(
        "SELECT latest_version FROM training_records WHERE record_id = ?",
        (record_id,),
    )
    row = cur.fetchone()
    if row is None:
        return True, 1
    return False, row["latest_version"] + 1


def _upsert_record_master(conn, rec: Dict[str, Any], version: int, is_new: bool):
    if is_new:
        conn.execute(
            """INSERT INTO training_records(record_id, pet_name, owner_name, latest_version)
               VALUES (?, ?, ?, ?)""",
            (rec["record_id"], rec["pet_name"], rec["owner_name"], version),
        )
    else:
        conn.execute(
            "UPDATE training_records SET latest_version = ? WHERE record_id = ?",
            (version, rec["record_id"]),
        )


def _insert_version(conn, rec: Dict[str, Any], version: int):
    conn.execute(
        """INSERT INTO training_record_versions(
            record_id, version, vaccine_date, training_date, course_type,
            trainer, medication_reminder, handwritten_note, status,
            operator, change_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            rec["record_id"],
            version,
            rec.get("vaccine_date"),
            rec["training_date"],
            rec["course_type"],
            rec.get("trainer"),
            rec.get("medication_reminder"),
            rec.get("handwritten_note"),
            rec.get("status", "pending"),
            rec.get("operator"),
            rec.get("change_reason"),
        ),
    )


def _insert_attachments(conn, rec: Dict[str, Any], version: int):
    attachments = rec.get("attachments") or []
    for att in attachments:
        conn.execute(
            """INSERT INTO record_attachments(
                record_id, version, attachment_type, attachment_ref, description
            ) VALUES (?, ?, ?, ?, ?)""",
            (
                rec["record_id"],
                version,
                att.get("attachment_type", "screenshot"),
                att.get("attachment_ref", ""),
                att.get("description"),
            ),
        )


def import_records(records: List[Dict[str, Any]], db_path: str = None) -> ImportResult:
    result = ImportResult(total=len(records))
    with get_conn(db_path) as conn:
        for idx, rec in enumerate(records, 1):
            try:
                err = _validate_record(rec)
                if err:
                    result.failed += 1
                    result.errors.append(f"第{idx}条: {err}")
                    continue
                is_new, version = _get_next_version(conn, rec["record_id"])
                _upsert_record_master(conn, rec, version, is_new)
                _insert_version(conn, rec, version)
                _insert_attachments(conn, rec, version)
                result.imported_ids.append((rec["record_id"], version))
                if is_new:
                    result.inserted += 1
                else:
                    result.versioned += 1
            except Exception as e:
                result.failed += 1
                result.errors.append(f"第{idx}条[{rec.get('record_id')}]: {str(e)}")
    return result


def import_from_file(file_path: str, db_path: str = None) -> ImportResult:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        data = [data]
    return import_records(data, db_path=db_path)


def get_record_history(record_id: str, db_path: str = None) -> List[Dict[str, Any]]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """SELECT v.*, r.pet_name, r.owner_name
               FROM training_record_versions v
               JOIN training_records r ON r.record_id = v.record_id
               WHERE v.record_id = ?
               ORDER BY v.version ASC""",
            (record_id,),
        ).fetchall()
        history = []
        for row in rows:
            d = dict(row)
            atts = conn.execute(
                """SELECT attachment_type, attachment_ref, description, created_at
                   FROM record_attachments
                   WHERE record_id = ? AND version = ?
                   ORDER BY id ASC""",
                (record_id, d["version"]),
            ).fetchall()
            d["attachments"] = [dict(a) for a in atts]
            history.append(d)
        return history


def get_all_latest_versions(db_path: str = None) -> List[Dict[str, Any]]:
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """SELECT v.*, r.pet_name, r.owner_name
               FROM training_record_versions v
               JOIN training_records r ON r.record_id = v.record_id
               WHERE v.version = r.latest_version
               ORDER BY v.created_at ASC""",
        ).fetchall()
        return [dict(row) for row in rows]
