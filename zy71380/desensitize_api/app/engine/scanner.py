from __future__ import annotations

import json
from datetime import datetime
from app.database import get_connection
from app.engine.rule_manager import get_active_rule, get_rule_by_version
from app.engine.desensitizer import desensitize_text, desensitize_json, desensitize_phone
from app.engine.exception_manager import list_active_exceptions, refresh_expired


def create_scan_task(source_type: str, source_data: str, rule_version: str | None = None) -> dict:
    refresh_expired()
    if rule_version:
        rule = get_rule_by_version(rule_version)
        if not rule:
            raise ValueError(f"Rule version '{rule_version}' not found")
    else:
        rule = get_active_rule()
        if not rule:
            raise ValueError("No active rule found. Please activate a rule first.")

    exceptions = list_active_exceptions()
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        cursor = conn.execute(
            """INSERT INTO scan_tasks
               (rule_version, source_type, source_data, status, created_at)
               VALUES (?, ?, ?, 'running', ?)""",
            (rule["version"], source_type, source_data, now),
        )
        task_id = cursor.lastrowid

        if source_type == "json":
            scan_results = _scan_json(source_data, rule, exceptions)
        else:
            scan_results = _scan_text(source_data, source_type, rule, exceptions)

        inconsistent = [r for r in scan_results if not r["is_consistent"]]
        blocked = [r for r in scan_results if r.get("block_reason")]

        for idx, result in enumerate(scan_results):
            conn.execute(
                """INSERT INTO scan_results
                   (task_id, processing_order, field_path, original_value,
                    desensitized_value, expected_value, is_consistent,
                    block_reason, exception_id, source_location, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (task_id, idx + 1, result["field_path"], result["original_value"],
                 result["desensitized_value"], result["expected_value"],
                 1 if result["is_consistent"] else 0, result.get("block_reason"),
                 result.get("exception_id"), result.get("source_location", ""), now),
            )

        completed_at = datetime.utcnow().isoformat()
        conn.execute(
            """UPDATE scan_tasks
               SET status='completed', total_fields=?, inconsistent_count=?,
                   blocked_count=?, completed_at=?
               WHERE id=?""",
            (len(scan_results), len(inconsistent), len(blocked), completed_at, task_id),
        )
        conn.commit()
        return get_scan_task(task_id)
    finally:
        conn.close()


def _scan_text(source_data: str, source_type: str, rule: dict, exceptions: list[dict]) -> list[dict]:
    return desensitize_text(source_data, rule, exceptions)


def _scan_json(source_data: str, rule: dict, exceptions: list[dict]) -> list[dict]:
    try:
        parsed = json.loads(source_data)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON source data: {e}")
    return desensitize_json(parsed, rule, exceptions)


def get_scan_task(task_id: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM scan_tasks WHERE id = ?", (task_id,)).fetchone()
        if not row:
            return None
        return _task_row_to_dict(row)
    finally:
        conn.close()


def list_scan_tasks() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM scan_tasks ORDER BY created_at DESC").fetchall()
        return [_task_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_scan_results(task_id: int) -> dict | None:
    conn = get_connection()
    try:
        task_row = conn.execute("SELECT * FROM scan_tasks WHERE id = ?", (task_id,)).fetchone()
        if not task_row:
            return None
        result_rows = conn.execute(
            "SELECT * FROM scan_results WHERE task_id = ? ORDER BY processing_order",
            (task_id,),
        ).fetchall()
        return {
            "task": _task_row_to_dict(task_row),
            "results": [_result_row_to_dict(r) for r in result_rows],
        }
    finally:
        conn.close()


def diff_scan_results(task_id_1: int, task_id_2: int) -> dict:
    r1 = get_scan_results(task_id_1)
    r2 = get_scan_results(task_id_2)
    if not r1 or not r2:
        raise ValueError("One or both scan tasks not found")

    results_1 = {r["field_path"]: r for r in r1["results"]}
    results_2 = {r["field_path"]: r for r in r2["results"]}

    all_paths = sorted(set(results_1.keys()) | set(results_2.keys()))
    diffs = []
    for path in all_paths:
        in_1 = path in results_1
        in_2 = path in results_2
        if in_1 and in_2:
            r1_item = results_1[path]
            r2_item = results_2[path]
            if r1_item["desensitized_value"] != r2_item["desensitized_value"]:
                diffs.append({
                    "field_path": path,
                    "diff_type": "VALUE_MISMATCH",
                    "task_1_desensitized": r1_item["desensitized_value"],
                    "task_2_desensitized": r2_item["desensitized_value"],
                    "task_1_expected": r1_item["expected_value"],
                    "task_2_expected": r2_item["expected_value"],
                    "task_1_block_reason": r1_item.get("block_reason"),
                    "task_2_block_reason": r2_item.get("block_reason"),
                })
        elif in_1 and not in_2:
            diffs.append({
                "field_path": path,
                "diff_type": "ONLY_IN_TASK_1",
                "task_1_desensitized": results_1[path]["desensitized_value"],
                "task_2_desensitized": None,
                "task_1_block_reason": results_1[path].get("block_reason"),
                "task_2_block_reason": None,
            })
        else:
            diffs.append({
                "field_path": path,
                "diff_type": "ONLY_IN_TASK_2",
                "task_1_desensitized": None,
                "task_2_desensitized": results_2[path]["desensitized_value"],
                "task_1_block_reason": None,
                "task_2_block_reason": results_2[path].get("block_reason"),
            })

    return {
        "task_1": r1["task"],
        "task_2": r2["task"],
        "total_diffs": len(diffs),
        "diffs": diffs,
    }


def _task_row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "rule_version": row["rule_version"],
        "source_type": row["source_type"],
        "status": row["status"],
        "total_fields": row["total_fields"],
        "inconsistent_count": row["inconsistent_count"],
        "blocked_count": row["blocked_count"],
        "created_at": row["created_at"],
        "completed_at": row["completed_at"],
    }


def _result_row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "task_id": row["task_id"],
        "processing_order": row["processing_order"],
        "field_path": row["field_path"],
        "original_value": row["original_value"],
        "desensitized_value": row["desensitized_value"],
        "expected_value": row["expected_value"],
        "is_consistent": bool(row["is_consistent"]),
        "block_reason": row["block_reason"],
        "exception_id": row["exception_id"],
        "source_location": row["source_location"],
    }
