from __future__ import annotations

import json
import csv
import io
from datetime import datetime
from app.database import get_connection
from app.engine.scanner import get_scan_task, get_scan_results
from app.engine.rule_manager import get_rule_by_version
from app.engine.exception_manager import list_active_exceptions


def generate_report(task_id: int, export_format: str = "json") -> dict:
    task = get_scan_task(task_id)
    if not task:
        raise ValueError(f"Scan task {task_id} not found")

    results_data = get_scan_results(task_id)
    if not results_data:
        raise ValueError(f"No results found for scan task {task_id}")

    rule = get_rule_by_version(task["rule_version"])
    rule_snapshot = rule if rule else {}
    exceptions = list_active_exceptions()
    exception_snapshot = exceptions

    results = results_data["results"]
    consistent = [r for r in results if r["is_consistent"]]
    inconsistent = [r for r in results if not r["is_consistent"]]
    blocked = [r for r in results if r.get("block_reason")]

    block_reasons = {}
    for r in blocked:
        reason = r["block_reason"] or "UNKNOWN"
        base_reason = reason.split(":")[0]
        block_reasons[base_reason] = block_reasons.get(base_reason, 0) + 1

    summary = {
        "total_fields": task["total_fields"],
        "consistent_count": len(consistent),
        "inconsistent_count": task["inconsistent_count"],
        "blocked_count": task["blocked_count"],
        "block_reasons": block_reasons,
        "rule_version": task["rule_version"],
        "source_type": task["source_type"],
    }

    details = []
    for r in results:
        details.append({
            "processing_order": r["processing_order"],
            "field_path": r["field_path"],
            "original_value": r["original_value"],
            "desensitized_value": r["desensitized_value"],
            "expected_value": r["expected_value"],
            "is_consistent": r["is_consistent"],
            "block_reason": r.get("block_reason"),
            "source_location": r.get("source_location", ""),
        })

    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        cursor = conn.execute(
            """INSERT INTO audit_reports
               (task_id, rule_snapshot, exception_snapshot, summary,
                details, export_format, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (task_id,
             json.dumps(rule_snapshot, ensure_ascii=False),
             json.dumps(exception_snapshot, ensure_ascii=False),
             json.dumps(summary, ensure_ascii=False),
             json.dumps(details, ensure_ascii=False),
             export_format, now),
        )
        conn.commit()
        report_id = cursor.lastrowid
        return get_report(report_id)
    finally:
        conn.close()


def get_report(report_id: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM audit_reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "task_id": row["task_id"],
            "rule_snapshot": json.loads(row["rule_snapshot"]),
            "exception_snapshot": json.loads(row["exception_snapshot"]),
            "summary": json.loads(row["summary"]),
            "details": json.loads(row["details"]),
            "export_format": row["export_format"],
            "created_at": row["created_at"],
        }
    finally:
        conn.close()


def export_report(report_id: int) -> tuple[str, str]:
    report = get_report(report_id)
    if not report:
        raise ValueError(f"Report {report_id} not found")

    fmt = report["export_format"]
    if fmt == "csv":
        return _export_csv(report), "text/csv"
    return _export_json(report), "application/json"


def list_reports() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM audit_reports ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "task_id": row["task_id"],
                "rule_snapshot": json.loads(row["rule_snapshot"]),
                "exception_snapshot": json.loads(row["exception_snapshot"]),
                "summary": json.loads(row["summary"]),
                "details": json.loads(row["details"]),
                "export_format": row["export_format"],
                "created_at": row["created_at"],
            })
        return result
    finally:
        conn.close()


def _export_json(report: dict) -> str:
    return json.dumps({
        "report_id": report["id"],
        "task_id": report["task_id"],
        "generated_at": report["created_at"],
        "rule_snapshot": report["rule_snapshot"],
        "exception_snapshot": report["exception_snapshot"],
        "summary": report["summary"],
        "details": report["details"],
    }, ensure_ascii=False, indent=2)


def _export_csv(report: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "processing_order", "field_path", "original_value",
        "desensitized_value", "expected_value", "is_consistent",
        "block_reason", "source_location",
    ])
    for detail in report["details"]:
        writer.writerow([
            detail["processing_order"],
            detail["field_path"],
            detail["original_value"],
            detail["desensitized_value"],
            detail["expected_value"],
            detail["is_consistent"],
            detail.get("block_reason", ""),
            detail.get("source_location", ""),
        ])
    return output.getvalue()
