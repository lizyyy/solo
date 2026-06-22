from __future__ import annotations

import csv
import io
import json
import sqlite3
from dataclasses import dataclass
from typing import Any

from .database import init_db


KNOWN_ALIASES = {
    "小黄": "小黄",
    "黄黄": "小黄",
    "阿黑": "阿黑",
}


@dataclass(frozen=True)
class ScheduleImportRow:
    pet_name: str
    course_name: str
    course_date: str
    duration_min: int
    trainer: str
    source_row: str


@dataclass(frozen=True)
class MedicalRecordInput:
    pet_name: str
    visit_date: str
    diagnosis: str
    treatment: str
    veterinarian: str
    linked_schedule_id: int | None = None
    source_row: str = "manual-1"


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any]:
    return dict(row) if row is not None else {}


def create_source(conn: sqlite3.Connection, source_type: str, label: str, payload: Any, imported_by: str = "小乔") -> int:
    cur = conn.execute(
        "INSERT INTO sources(source_type, label, raw_payload, imported_by) VALUES (?, ?, ?, ?)",
        (source_type, label, json.dumps(payload, ensure_ascii=False), imported_by),
    )
    return int(cur.lastrowid)


def ensure_pet(conn: sqlite3.Connection, canonical_name: str, alias_name: str | None = None, source_id: int | None = None) -> int:
    conn.execute("INSERT OR IGNORE INTO pets(canonical_name, species) VALUES (?, '犬')", (canonical_name,))
    pet_id = int(conn.execute("SELECT id FROM pets WHERE canonical_name = ?", (canonical_name,)).fetchone()["id"])
    for name in {canonical_name, alias_name or canonical_name}:
        conn.execute(
            """
            INSERT OR IGNORE INTO aliases(pet_id, alias_name, source_id, linked_record_type)
            VALUES (?, ?, ?, 'seed')
            """,
            (pet_id, name, source_id),
        )
    return pet_id


def resolve_alias(conn: sqlite3.Connection, pet_name: str) -> tuple[int | None, str | None, str]:
    row = conn.execute(
        """
        SELECT p.id, p.canonical_name
        FROM aliases a
        JOIN pets p ON p.id = a.pet_id
        WHERE a.alias_name = ?
        """,
        (pet_name,),
    ).fetchone()
    if row:
        return int(row["id"]), str(row["canonical_name"]), ""

    if pet_name in KNOWN_ALIASES:
        canonical = KNOWN_ALIASES[pet_name]
        pet_id = ensure_pet(conn, canonical, pet_name)
        return pet_id, canonical, ""

    return None, None, f"宠物别名“{pet_name}”未绑定，需补看来源并确认影响范围"


def parse_schedule_csv(csv_text: str) -> list[ScheduleImportRow]:
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    required = ["pet_name", "course_name", "course_date", "duration_min", "trainer"]
    missing = [name for name in required if name not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"CSV 缺少字段: {', '.join(missing)}")

    rows: list[ScheduleImportRow] = []
    for index, raw in enumerate(reader, start=2):
        pet_name = (raw.get("pet_name") or "").strip()
        course_name = (raw.get("course_name") or "").strip()
        course_date = (raw.get("course_date") or "").strip()
        trainer = (raw.get("trainer") or "").strip()
        duration_raw = (raw.get("duration_min") or "").strip()
        if not all([pet_name, course_name, course_date, trainer, duration_raw]):
            raise ValueError(f"CSV 第 {index} 行存在空字段")
        rows.append(
            ScheduleImportRow(
                pet_name=pet_name,
                course_name=course_name,
                course_date=course_date,
                duration_min=int(duration_raw),
                trainer=trainer,
                source_row=f"csv:{index}",
            )
        )
    return rows


def import_schedules(conn: sqlite3.Connection, csv_text: str, label: str = "training-schedules.csv") -> dict[str, Any]:
    init_db(conn)
    rows = parse_schedule_csv(csv_text)
    source_id = create_source(conn, "csv", label, [row.__dict__ for row in rows])
    imported: list[dict[str, Any]] = []
    anomalies: list[dict[str, Any]] = []

    for item in rows:
        pet_id, _canonical, reason = resolve_alias(conn, item.pet_name)
        status = "pending" if pet_id else "anomaly"
        cur = conn.execute(
            """
            INSERT INTO schedules(
                pet_name, pet_id, course_name, course_date, duration_min, trainer,
                status, anomaly_reason, source_id, source_row
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item.pet_name,
                pet_id,
                item.course_name,
                item.course_date,
                item.duration_min,
                item.trainer,
                status,
                reason,
                source_id,
                item.source_row,
            ),
        )
        schedule = get_schedule(conn, int(cur.lastrowid))
        imported.append(schedule)
        if status == "anomaly":
            anomalies.append(schedule)

    return {"source_id": source_id, "imported": imported, "anomalies": anomalies}


def add_medical_record(conn: sqlite3.Connection, data: MedicalRecordInput) -> dict[str, Any]:
    init_db(conn)
    source_id = create_source(conn, "medical_form", f"手写单:{data.pet_name}:{data.visit_date}", data.__dict__)
    pet_id, _canonical, alias_reason = resolve_alias(conn, data.pet_name)
    linked_schedule = None
    link_reason = ""

    if data.linked_schedule_id:
        linked_schedule = get_schedule(conn, data.linked_schedule_id)
        if not linked_schedule:
            link_reason = f"指定排程 {data.linked_schedule_id} 不存在"
    else:
        linked_schedule = find_schedule_for_record(conn, data.pet_name, data.visit_date)

    status = "linked" if pet_id and linked_schedule else "needs_review"
    reason = alias_reason or link_reason
    if pet_id and not linked_schedule:
        reason = f"病历日期 {data.visit_date} 未找到可接续的训练排程"

    cur = conn.execute(
        """
        INSERT INTO medical_records(
            pet_name, pet_id, visit_date, diagnosis, treatment, veterinarian,
            linked_schedule_id, status, anomaly_reason, source_id, source_row
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.pet_name,
            pet_id,
            data.visit_date,
            data.diagnosis,
            data.treatment,
            data.veterinarian,
            linked_schedule["id"] if linked_schedule else None,
            status,
            reason,
            source_id,
            data.source_row,
        ),
    )
    return get_medical_record(conn, int(cur.lastrowid))


def find_schedule_for_record(conn: sqlite3.Connection, pet_name: str, visit_date: str) -> dict[str, Any]:
    pet_id, _canonical, _reason = resolve_alias(conn, pet_name)
    if pet_id:
        row = conn.execute(
            """
            SELECT * FROM schedules
            WHERE pet_id = ? AND course_date = ? AND status != 'anomaly'
            ORDER BY id DESC LIMIT 1
            """,
            (pet_id, visit_date),
        ).fetchone()
        return row_to_dict(row)
    return {}


def get_schedule(conn: sqlite3.Connection, schedule_id: int) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    return row_to_dict(row)


def list_medical_records_for_schedule(conn: sqlite3.Connection, schedule_id: int) -> list[dict[str, Any]]:
    schedule = get_schedule(conn, schedule_id)
    if not schedule:
        return []
    rows = conn.execute(
        """
        SELECT mr.*, src.label AS source_label, src.imported_at AS imported_at, src.source_type AS source_type
        FROM medical_records mr
        JOIN sources src ON src.id = mr.source_id
        WHERE mr.linked_schedule_id = ?
           OR mr.pet_name = ?
           OR (mr.pet_id IS NOT NULL AND mr.pet_id = ?)
        ORDER BY mr.visit_date, mr.id
        """,
        (schedule_id, schedule["pet_name"], schedule.get("pet_id")),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def get_schedule_detail(conn: sqlite3.Connection, schedule_id: int) -> dict[str, Any]:
    schedule = get_schedule(conn, schedule_id)
    if not schedule:
        return {}
    source_row = conn.execute(
        "SELECT id, source_type, label, imported_by, imported_at, raw_payload FROM sources WHERE id = ?",
        (schedule["source_id"],),
    ).fetchone()
    source = row_to_dict(source_row)
    if source.get("raw_payload"):
        try:
            source["raw_payload"] = json.loads(source["raw_payload"])
        except (json.JSONDecodeError, TypeError):
            pass
    medical_records = list_medical_records_for_schedule(conn, schedule_id)
    return {
        "schedule": schedule,
        "source": source,
        "medical_records": medical_records,
    }


def get_medical_record(conn: sqlite3.Connection, record_id: int) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM medical_records WHERE id = ?", (record_id,)).fetchone()
    return row_to_dict(row)


def list_schedules(conn: sqlite3.Connection, include_anomalies: bool = True) -> list[dict[str, Any]]:
    where = "" if include_anomalies else "WHERE status != 'anomaly'"
    rows = conn.execute(f"SELECT * FROM schedules {where} ORDER BY course_date, id").fetchall()
    return [row_to_dict(row) for row in rows]


def list_anomalies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    schedule_rows = conn.execute(
        "SELECT * FROM schedules WHERE status = 'anomaly' ORDER BY id"
    ).fetchall()
    medical_rows = conn.execute(
        "SELECT * FROM medical_records WHERE status = 'needs_review' ORDER BY id"
    ).fetchall()
    return [
        {"kind": "schedule", "record": row_to_dict(row), "impact": impact_for_schedule(conn, int(row["id"]))}
        for row in schedule_rows
    ] + [
        {"kind": "medical_record", "record": row_to_dict(row), "impact": impact_for_medical(conn, int(row["id"]))}
        for row in medical_rows
    ]


def impact_for_schedule(conn: sqlite3.Connection, schedule_id: int) -> list[dict[str, Any]]:
    schedule = get_schedule(conn, schedule_id)
    if not schedule:
        return []
    rows = conn.execute(
        """
        SELECT * FROM medical_records
        WHERE pet_name = ? OR linked_schedule_id = ?
        ORDER BY id
        """,
        (schedule["pet_name"], schedule_id),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def impact_for_medical(conn: sqlite3.Connection, record_id: int) -> list[dict[str, Any]]:
    record = get_medical_record(conn, record_id)
    if not record:
        return []
    rows = conn.execute(
        """
        SELECT * FROM schedules
        WHERE pet_name = ? OR id = ?
        ORDER BY id
        """,
        (record["pet_name"], record.get("linked_schedule_id")),
    ).fetchall()
    return [row_to_dict(row) for row in rows]


def confirm_schedule(conn: sqlite3.Connection, schedule_id: int, operator: str = "小乔", remark: str = "") -> dict[str, Any]:
    before = get_schedule(conn, schedule_id)
    if not before:
        raise ValueError(f"排程 {schedule_id} 不存在")
    if before["status"] == "anomaly":
        raise ValueError("异常记录需要先绑定别名，不能揉进正常汇总")
    conn.execute(
        """
        UPDATE schedules
        SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP, withdrawn_at = NULL
        WHERE id = ?
        """,
        (operator, schedule_id),
    )
    after = get_schedule(conn, schedule_id)
    write_log(conn, "schedule", schedule_id, "confirm", operator, remark, before, after)
    return after


def withdraw_schedule(conn: sqlite3.Connection, schedule_id: int, operator: str = "小乔", remark: str = "") -> dict[str, Any]:
    before = get_schedule(conn, schedule_id)
    if not before:
        raise ValueError(f"排程 {schedule_id} 不存在")
    if before["status"] != "confirmed":
        raise ValueError("只有已确认的排程才能撤回")
    conn.execute(
        """
        UPDATE schedules
        SET status = 'pending', confirmed_by = '', confirmed_at = NULL, withdrawn_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (schedule_id,),
    )
    after = get_schedule(conn, schedule_id)
    write_log(conn, "schedule", schedule_id, "withdraw", operator, remark, before, after)
    return after


def bind_alias(conn: sqlite3.Connection, alias_name: str, canonical_name: str, operator: str = "小乔") -> dict[str, Any]:
    pet_id = ensure_pet(conn, canonical_name, alias_name)
    affected_before = {
        "schedules": [row_to_dict(row) for row in conn.execute("SELECT * FROM schedules WHERE pet_name = ?", (alias_name,)).fetchall()],
        "medical_records": [
            row_to_dict(row) for row in conn.execute("SELECT * FROM medical_records WHERE pet_name = ?", (alias_name,)).fetchall()
        ],
    }
    conn.execute(
        "UPDATE schedules SET pet_id = ?, status = 'pending', anomaly_reason = '' WHERE pet_name = ? AND status = 'anomaly'",
        (pet_id, alias_name),
    )
    conn.execute(
        "UPDATE medical_records SET pet_id = ?, status = 'linked', anomaly_reason = '' WHERE pet_name = ? AND status = 'needs_review'",
        (pet_id, alias_name),
    )
    affected_after = {
        "schedules": [row_to_dict(row) for row in conn.execute("SELECT * FROM schedules WHERE pet_name = ?", (alias_name,)).fetchall()],
        "medical_records": [
            row_to_dict(row) for row in conn.execute("SELECT * FROM medical_records WHERE pet_name = ?", (alias_name,)).fetchall()
        ],
    }
    write_log(conn, "alias", pet_id, "bind_alias", operator, f"{alias_name} -> {canonical_name}", affected_before, affected_after)
    return {"pet_id": pet_id, "alias_name": alias_name, "canonical_name": canonical_name, "affected": affected_after}


def write_log(
    conn: sqlite3.Connection,
    target_type: str,
    target_id: int,
    action: str,
    operator: str,
    remark: str,
    before: Any,
    after: Any,
) -> None:
    conn.execute(
        """
        INSERT INTO operation_logs(target_type, target_id, action, operator, remark, before_state, after_state)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            target_type,
            target_id,
            action,
            operator,
            remark,
            json.dumps(before, ensure_ascii=False, sort_keys=True),
            json.dumps(after, ensure_ascii=False, sort_keys=True),
        ),
    )


def list_logs(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute("SELECT * FROM operation_logs ORDER BY id DESC").fetchall()
    result: list[dict[str, Any]] = []
    for row in rows:
        item = row_to_dict(row)
        item["before_state"] = json.loads(item["before_state"])
        item["after_state"] = json.loads(item["after_state"])
        result.append(item)
    return result


def summary(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute("SELECT status, COUNT(*) AS count FROM schedules GROUP BY status").fetchall()
    counts = {row["status"]: int(row["count"]) for row in rows}
    total_normal = sum(count for status, count in counts.items() if status != "anomaly")
    return {
        "total_normal_schedules": total_normal,
        "pending": counts.get("pending", 0),
        "confirmed": counts.get("confirmed", 0),
        "withdrawn": counts.get("withdrawn", 0),
        "anomalies": counts.get("anomaly", 0)
        + int(conn.execute("SELECT COUNT(*) AS c FROM medical_records WHERE status = 'needs_review'").fetchone()["c"]),
    }


def export_detail_csv(conn: sqlite3.Connection) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "schedule_id",
            "pet_name",
            "canonical_pet_id",
            "course_name",
            "course_date",
            "duration_min",
            "trainer",
            "status",
            "source_label",
            "source_row",
            "anomaly_reason",
        ],
    )
    writer.writeheader()
    rows = conn.execute(
        """
        SELECT s.id AS schedule_id, s.pet_name, s.pet_id AS canonical_pet_id,
               s.course_name, s.course_date, s.duration_min, s.trainer, s.status,
               src.label AS source_label, s.source_row, s.anomaly_reason
        FROM schedules s
        JOIN sources src ON src.id = s.source_id
        ORDER BY s.course_date, s.id
        """
    ).fetchall()
    for row in rows:
        writer.writerow(row_to_dict(row))
    return output.getvalue()


def seed_demo(conn: sqlite3.Connection) -> dict[str, Any]:
    init_db(conn)
    if conn.execute("SELECT COUNT(*) AS c FROM sources").fetchone()["c"]:
        return {"seeded": False, "summary": summary(conn)}

    source_id = create_source(conn, "csv", "seed.csv", {"seed": True})
    ensure_pet(conn, "小黄", "黄黄", source_id)
    ensure_pet(conn, "阿黑", "阿黑", source_id)
    csv_text = """pet_name,course_name,course_date,duration_min,trainer
小黄,基础服从课,2026-06-01,60,阿岑
阿黑,社交课,2026-06-02,45,阿岑
黄黄,基础服从课,2026-06-03,60,阿岑
黑妞,唤回课,2026-06-04,30,阿岑
"""
    imported = import_schedules(conn, csv_text, "seed-training-schedules.csv")
    add_medical_record(
        conn,
        MedicalRecordInput(
            pet_name="黄黄",
            visit_date="2026-06-03",
            diagnosis="皮肤检查",
            treatment="训练强度正常",
            veterinarian="小温",
            source_row="medical:1",
        ),
    )
    add_medical_record(
        conn,
        MedicalRecordInput(
            pet_name="黑妞",
            visit_date="2026-06-04",
            diagnosis="疫苗接种",
            treatment="需确认是否与阿黑同宠",
            veterinarian="小温",
            source_row="medical:2",
        ),
    )
    confirm_schedule(conn, imported["imported"][0]["id"], operator="小乔", remark="正常记录样例，供接班人核对口径")
    return {"seeded": True, "summary": summary(conn)}

