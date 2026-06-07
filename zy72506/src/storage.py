import sqlite3
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from pathlib import Path

from .models import (
    VerificationRecord, VerificationStatus, ConflictType,
    SampleRecord, ManualJudgement, BatchInfo, OperationLog
)


DB_PATH = Path(__file__).parent.parent / "data" / "verification.db"


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS batches (
            batch_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            model_version TEXT NOT NULL,
            total_samples INTEGER DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS verification_records (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            sample_id TEXT NOT NULL,
            status TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            current_model_version TEXT NOT NULL,
            previous_model_version TEXT,
            sample_json TEXT NOT NULL,
            manual_judgement_json TEXT,
            operation_review_comment TEXT,
            operation_reviewed_by TEXT,
            operation_reviewed_at TEXT,
            ai_pm_review_comment TEXT,
            ai_pm_reviewed_by TEXT,
            ai_pm_reviewed_at TEXT,
            status_history_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(batch_id, sample_id)
        );

        CREATE INDEX IF NOT EXISTS idx_records_batch ON verification_records(batch_id);
        CREATE INDEX IF NOT EXISTS idx_records_status ON verification_records(status);
        CREATE INDEX IF NOT EXISTS idx_records_sample ON verification_records(sample_id);
        CREATE INDEX IF NOT EXISTS idx_records_conflict ON verification_records(conflict_type);

        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            sample_id TEXT,
            operation TEXT NOT NULL,
            operator TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            details_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id);
        CREATE INDEX IF NOT EXISTS idx_logs_sample ON operation_logs(sample_id);
        """)


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _record_from_row(row: sqlite3.Row) -> VerificationRecord:
    data = dict(row)
    sample = SampleRecord(**json.loads(data.pop("sample_json")))
    manual_judgement = None
    if data.get("manual_judgement_json"):
        manual_judgement = ManualJudgement(**json.loads(data["manual_judgement_json"]))
    status_history = json.loads(data.pop("status_history_json", "[]"))
    record = VerificationRecord(
        **data,
        sample=sample,
        manual_judgement=manual_judgement,
        status_history=status_history
    )
    return record


def save_batch(batch: BatchInfo):
    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO batches
               (batch_id, name, model_version, total_samples, created_by, created_at, description)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                batch.batch_id, batch.name, batch.model_version, batch.total_samples,
                batch.created_by, batch.created_at.isoformat(), batch.description
            )
        )


def get_batch(batch_id: str) -> Optional[BatchInfo]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM batches WHERE batch_id = ?", (batch_id,)).fetchone()
        if row:
            return BatchInfo(**dict(row))
    return None


def list_batches() -> List[BatchInfo]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM batches ORDER BY created_at DESC").fetchall()
        return [BatchInfo(**dict(row)) for row in rows]


def save_verification_record(record: VerificationRecord):
    with get_conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO verification_records
               (id, batch_id, sample_id, status, conflict_type, current_model_version,
                previous_model_version, sample_json, manual_judgement_json,
                operation_review_comment, operation_reviewed_by, operation_reviewed_at,
                ai_pm_review_comment, ai_pm_reviewed_by, ai_pm_reviewed_at,
                status_history_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                record.id, record.batch_id, record.sample_id, record.status,
                record.conflict_type, record.current_model_version,
                record.previous_model_version,
                record.sample.model_dump_json(),
                record.manual_judgement.model_dump_json() if record.manual_judgement else None,
                record.operation_review_comment, record.operation_reviewed_by,
                record.operation_reviewed_at.isoformat() if record.operation_reviewed_at else None,
                record.ai_pm_review_comment, record.ai_pm_reviewed_by,
                record.ai_pm_reviewed_at.isoformat() if record.ai_pm_reviewed_at else None,
                json.dumps([h for h in record.status_history]),
                record.created_at.isoformat(), record.updated_at.isoformat()
            )
        )


def get_verification_record(batch_id: str, sample_id: str) -> Optional[VerificationRecord]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM verification_records WHERE batch_id = ? AND sample_id = ?",
            (batch_id, sample_id)
        ).fetchone()
        if row:
            return _record_from_row(row)
    return None


def get_verification_record_by_id(record_id: str) -> Optional[VerificationRecord]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM verification_records WHERE id = ?",
            (record_id,)
        ).fetchone()
        if row:
            return _record_from_row(row)
    return None


def list_verification_records(
    batch_id: Optional[str] = None,
    status: Optional[VerificationStatus] = None,
    conflict_type: Optional[ConflictType] = None,
    sample_id: Optional[str] = None
) -> List[VerificationRecord]:
    query = "SELECT * FROM verification_records WHERE 1=1"
    params: List[Any] = []

    if batch_id:
        query += " AND batch_id = ?"
        params.append(batch_id)
    if status:
        query += " AND status = ?"
        params.append(status)
    if conflict_type:
        query += " AND conflict_type = ?"
        params.append(conflict_type)
    if sample_id:
        query += " AND sample_id = ?"
        params.append(sample_id)

    query += " ORDER BY created_at DESC"

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [_record_from_row(row) for row in rows]


def find_existing_sample(sample_id: str) -> Optional[VerificationRecord]:
    with get_conn() as conn:
        row = conn.execute(
            """SELECT * FROM verification_records
               WHERE sample_id = ?
               ORDER BY created_at DESC LIMIT 1""",
            (sample_id,)
        ).fetchone()
        if row:
            return _record_from_row(row)
    return None


def add_operation_log(batch_id: str, operation: str, operator: str,
                      sample_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
    log = OperationLog(
        id=str(uuid.uuid4()),
        batch_id=batch_id,
        sample_id=sample_id,
        operation=operation,
        operator=operator,
        details=details or {}
    )
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO operation_logs
               (id, batch_id, sample_id, operation, operator, timestamp, details_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                log.id, log.batch_id, log.sample_id, log.operation,
                log.operator, log.timestamp.isoformat(),
                json.dumps(log.details)
            )
        )


def list_operation_logs(batch_id: Optional[str] = None, sample_id: Optional[str] = None,
                        limit: int = 100) -> List[OperationLog]:
    query = "SELECT * FROM operation_logs WHERE 1=1"
    params: List[Any] = []

    if batch_id:
        query += " AND batch_id = ?"
        params.append(batch_id)
    if sample_id:
        query += " AND sample_id = ?"
        params.append(sample_id)

    query += " ORDER BY timestamp DESC LIMIT ?"
    params.append(limit)

    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        logs = []
        for row in rows:
            data = dict(row)
            details = json.loads(data.pop("details_json", "{}"))
            logs.append(OperationLog(**data, details=details))
        return logs


def get_batch_statistics(batch_id: str) -> Dict[str, Any]:
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM verification_records WHERE batch_id = ?",
            (batch_id,)
        ).fetchone()[0]

        status_counts = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM verification_records WHERE batch_id = ? GROUP BY status",
            (batch_id,)
        ).fetchall()

        conflict_counts = conn.execute(
            "SELECT conflict_type, COUNT(*) as cnt FROM verification_records WHERE batch_id = ? GROUP BY conflict_type",
            (batch_id,)
        ).fetchall()

        return {
            "total": total,
            "by_status": {row["status"]: row["cnt"] for row in status_counts},
            "by_conflict": {row["conflict_type"]: row["cnt"] for row in conflict_counts}
        }
