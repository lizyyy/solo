import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import DB_PATH


@contextmanager
def get_conn(db_path: str = None):
    path = db_path or DB_PATH
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS training_records (
    record_id TEXT PRIMARY KEY,
    pet_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    latest_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS training_record_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    vaccine_date TEXT,
    training_date TEXT NOT NULL,
    course_type TEXT NOT NULL,
    trainer TEXT,
    medication_reminder TEXT,
    handwritten_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    operator TEXT,
    change_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (record_id) REFERENCES training_records(record_id),
    UNIQUE(record_id, version)
);

CREATE TABLE IF NOT EXISTS record_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    attachment_type TEXT NOT NULL,
    attachment_ref TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (record_id, version) REFERENCES training_record_versions(record_id, version)
);

CREATE TABLE IF NOT EXISTS audit_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_tag TEXT NOT NULL UNIQUE,
    triggered_by TEXT,
    baseline_run_tag TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_run_id INTEGER NOT NULL,
    record_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    overall_status TEXT NOT NULL,
    anomaly_count INTEGER NOT NULL DEFAULT 0,
    detail_json TEXT,
    FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id)
);

CREATE TABLE IF NOT EXISTS anomalies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_result_id INTEGER NOT NULL,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    field_name TEXT,
    anomaly_reason TEXT NOT NULL,
    current_value TEXT,
    expected_value TEXT,
    FOREIGN KEY (audit_result_id) REFERENCES audit_results(id)
);

CREATE INDEX IF NOT EXISTS idx_versions_record ON training_record_versions(record_id, version);
CREATE INDEX IF NOT EXISTS idx_attachments_record ON record_attachments(record_id, version);
CREATE INDEX IF NOT EXISTS idx_anomalies_result ON anomalies(audit_result_id);
"""


def init_db(db_path: str = None):
    with get_conn(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
