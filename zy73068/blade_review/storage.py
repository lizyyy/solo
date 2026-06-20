from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime
from typing import Optional

from .models import (
    AuditLogEntry,
    BladeReport,
    InspectionRecord,
    JudgmentChange,
    MaterialType,
    ReviewStatus,
    SupplementaryMaterial,
    SuspensionRecord,
)

DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "blade_review.db"
)


def _now_iso() -> str:
    return datetime.now().isoformat()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


class ReportStore:
    SCHEMA = """
    CREATE TABLE IF NOT EXISTS reports (
        report_id TEXT PRIMARY KEY,
        title TEXT,
        blade_ids TEXT,
        status TEXT,
        request_hash TEXT,
        operator TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS records (
        record_id TEXT PRIMARY KEY,
        report_id TEXT,
        blade_id TEXT,
        timestamp TEXT,
        value REAL,
        metric_name TEXT,
        content_hash TEXT,
        manual_note TEXT
    );
    CREATE TABLE IF NOT EXISTS materials (
        material_id TEXT PRIMARY KEY,
        report_id TEXT,
        original_name TEXT,
        current_name TEXT,
        material_type TEXT,
        content_hash TEXT,
        content TEXT,
        version INTEGER,
        name_changed INTEGER,
        stance_changed INTEGER,
        previous_stance TEXT,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS material_versions (
        material_id TEXT,
        version INTEGER,
        name TEXT,
        content TEXT,
        captured_at TEXT,
        PRIMARY KEY (material_id, version)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        entry_id TEXT PRIMARY KEY,
        report_id TEXT,
        action TEXT,
        operator TEXT,
        timestamp TEXT,
        detail TEXT
    );
    CREATE TABLE IF NOT EXISTS judgment_changes (
        change_id TEXT PRIMARY KEY,
        entry_id TEXT,
        report_id TEXT,
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT,
        changed_by TEXT,
        reason TEXT
    );
    CREATE TABLE IF NOT EXISTS suspensions (
        suspension_id TEXT PRIMARY KEY,
        report_id TEXT,
        reason TEXT,
        gap_start TEXT,
        gap_end TEXT,
        created_at TEXT,
        resolved INTEGER,
        resolved_by TEXT,
        resolution_note TEXT
    );
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        self.db_path = db_path or DEFAULT_DB_PATH
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(self.SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "ReportStore":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def save_report(self, report: BladeReport) -> None:
        self.conn.execute(
            "DELETE FROM reports WHERE report_id = ?", (report.report_id,)
        )
        self.conn.execute(
            "DELETE FROM records WHERE report_id = ?", (report.report_id,)
        )
        self.conn.execute(
            "DELETE FROM materials WHERE report_id = ?", (report.report_id,)
        )
        self.conn.execute(
            "DELETE FROM audit_logs WHERE report_id = ?", (report.report_id,)
        )
        self.conn.execute(
            "DELETE FROM suspensions WHERE report_id = ?", (report.report_id,)
        )
        self.conn.commit()

        self.conn.execute(
            """INSERT INTO reports
               (report_id, title, blade_ids, status, request_hash, operator, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report.report_id,
                report.title,
                json.dumps(report.blade_ids, ensure_ascii=False),
                report.status.value,
                report.request_hash,
                report.operator,
                report.created_at.isoformat(),
                report.updated_at.isoformat(),
            ),
        )
        for rec in report.records:
            self.conn.execute(
                """INSERT INTO records
                   (record_id, report_id, blade_id, timestamp, value, metric_name, content_hash, manual_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    rec.record_id,
                    report.report_id,
                    rec.blade_id,
                    rec.timestamp.isoformat(),
                    rec.value,
                    rec.metric_name,
                    rec.content_hash,
                    rec.manual_note,
                ),
            )
        for mat in report.materials:
            self.conn.execute(
                """INSERT INTO materials
                   (material_id, report_id, original_name, current_name, material_type,
                    content_hash, content, version, name_changed, stance_changed,
                    previous_stance, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    mat.material_id,
                    report.report_id,
                    mat.original_name,
                    mat.current_name,
                    mat.material_type.value,
                    mat.content_hash,
                    mat.content,
                    mat.version,
                    int(mat.name_changed),
                    int(mat.stance_changed),
                    mat.previous_stance,
                    mat.created_at.isoformat(),
                ),
            )
        for entry in report.audit_logs:
            self.conn.execute(
                """INSERT INTO audit_logs
                   (entry_id, report_id, action, operator, timestamp, detail)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    entry.entry_id,
                    report.report_id,
                    entry.action,
                    entry.operator,
                    entry.timestamp.isoformat(),
                    entry.detail,
                ),
            )
            for ch in entry.changes:
                self.conn.execute(
                    """INSERT INTO judgment_changes
                       (change_id, entry_id, report_id, field_name, old_value, new_value,
                        changed_at, changed_by, reason)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        uuid.uuid4().hex[:12],
                        entry.entry_id,
                        report.report_id,
                        ch.field_name,
                        str(ch.old_value) if ch.old_value is not None else "",
                        str(ch.new_value) if ch.new_value is not None else "",
                        ch.changed_at.isoformat(),
                        ch.changed_by,
                        ch.reason,
                    ),
                )
        for susp in report.suspensions:
            self.conn.execute(
                """INSERT INTO suspensions
                   (suspension_id, report_id, reason, gap_start, gap_end, created_at,
                    resolved, resolved_by, resolution_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    susp.suspension_id,
                    report.report_id,
                    susp.reason,
                    susp.gap_start.isoformat() if susp.gap_start else "",
                    susp.gap_end.isoformat() if susp.gap_end else "",
                    susp.created_at.isoformat(),
                    int(susp.resolved),
                    susp.resolved_by,
                    susp.resolution_note,
                ),
            )
        self.conn.commit()

    def load_report(self, report_id: str) -> Optional[BladeReport]:
        row = self.conn.execute(
            "SELECT * FROM reports WHERE report_id = ?", (report_id,)
        ).fetchone()
        if not row:
            return None
        report = BladeReport(
            report_id=row["report_id"],
            title=row["title"],
            blade_ids=json.loads(row["blade_ids"]) if row["blade_ids"] else [],
            status=ReviewStatus(row["status"]),
            request_hash=row["request_hash"],
            operator=row["operator"],
            created_at=_parse_dt(row["created_at"]) or datetime.now(),
            updated_at=_parse_dt(row["updated_at"]) or datetime.now(),
        )
        for r in self.conn.execute(
            "SELECT * FROM records WHERE report_id = ?", (report_id,)
        ).fetchall():
            report.records.append(
                InspectionRecord(
                    record_id=r["record_id"],
                    blade_id=r["blade_id"],
                    timestamp=_parse_dt(r["timestamp"]) or datetime.now(),
                    value=r["value"],
                    metric_name=r["metric_name"],
                    content_hash=r["content_hash"],
                    manual_note=r["manual_note"],
                )
            )
        for m in self.conn.execute(
            "SELECT * FROM materials WHERE report_id = ?", (report_id,)
        ).fetchall():
            report.materials.append(
                SupplementaryMaterial(
                    material_id=m["material_id"],
                    original_name=m["original_name"],
                    current_name=m["current_name"],
                    material_type=MaterialType(m["material_type"]),
                    content_hash=m["content_hash"],
                    content=m["content"],
                    version=m["version"],
                    name_changed=bool(m["name_changed"]),
                    stance_changed=bool(m["stance_changed"]),
                    previous_stance=m["previous_stance"],
                    created_at=_parse_dt(m["created_at"]) or datetime.now(),
                )
            )
        for a in self.conn.execute(
            "SELECT * FROM audit_logs WHERE report_id = ? ORDER BY timestamp",
            (report_id,),
        ).fetchall():
            entry = AuditLogEntry(
                entry_id=a["entry_id"],
                report_id=a["report_id"],
                action=a["action"],
                operator=a["operator"],
                timestamp=_parse_dt(a["timestamp"]) or datetime.now(),
                detail=a["detail"],
            )
            for c in self.conn.execute(
                "SELECT * FROM judgment_changes WHERE entry_id = ? ORDER BY changed_at",
                (a["entry_id"],),
            ).fetchall():
                entry.changes.append(
                    JudgmentChange(
                        field_name=c["field_name"],
                        old_value=c["old_value"],
                        new_value=c["new_value"],
                        changed_at=_parse_dt(c["changed_at"]) or datetime.now(),
                        changed_by=c["changed_by"],
                        reason=c["reason"],
                    )
                )
            report.audit_logs.append(entry)
        for s in self.conn.execute(
            "SELECT * FROM suspensions WHERE report_id = ?", (report_id,)
        ).fetchall():
            report.suspensions.append(
                SuspensionRecord(
                    suspension_id=s["suspension_id"],
                    report_id=s["report_id"],
                    reason=s["reason"],
                    gap_start=_parse_dt(s["gap_start"]),
                    gap_end=_parse_dt(s["gap_end"]),
                    created_at=_parse_dt(s["created_at"]) or datetime.now(),
                    resolved=bool(s["resolved"]),
                    resolved_by=s["resolved_by"],
                    resolution_note=s["resolution_note"],
                )
            )
        return report

    def list_reports(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT report_id, title, blade_ids, status, operator, updated_at "
            "FROM reports ORDER BY updated_at DESC"
        ).fetchall()
        result = []
        for r in rows:
            result.append(
                {
                    "report_id": r["report_id"],
                    "title": r["title"],
                    "blade_ids": json.loads(r["blade_ids"]) if r["blade_ids"] else [],
                    "status": r["status"],
                    "operator": r["operator"],
                    "updated_at": r["updated_at"],
                }
            )
        return result

    def find_by_request_hash(self, request_hash: str) -> Optional[BladeReport]:
        row = self.conn.execute(
            "SELECT report_id FROM reports WHERE request_hash = ?",
            (request_hash,),
        ).fetchone()
        if not row:
            return None
        return self.load_report(row["report_id"])

    def resolve_suspension(
        self,
        report_id: str,
        suspension_id: str,
        resolved_by: str,
        resolution_note: str,
    ) -> bool:
        cur = self.conn.execute(
            "UPDATE suspensions SET resolved = 1, resolved_by = ?, resolution_note = ? "
            "WHERE suspension_id = ? AND report_id = ? AND resolved = 0",
            (resolved_by, resolution_note, suspension_id, report_id),
        )
        self.conn.commit()
        return cur.rowcount > 0
