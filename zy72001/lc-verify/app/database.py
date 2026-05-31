import sqlite3
import os
from contextlib import contextmanager

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_PROJECT_ROOT, "data", "lc_verify.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS batch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL REFERENCES batch(batch_id),
    lc_number TEXT NOT NULL,
    applicant TEXT,
    beneficiary TEXT,
    amount_raw TEXT,
    amount REAL,
    currency TEXT,
    date_raw TEXT,
    date TEXT,
    operator_name TEXT,
    source TEXT NOT NULL DEFAULT 'import',
    source_detail TEXT,
    voucher_reference TEXT,
    has_voucher INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    conflict_detail TEXT,
    suggested_action TEXT,
    verification_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS conflict (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL REFERENCES record(id),
    field_name TEXT NOT NULL,
    imported_value TEXT,
    screenshot_value TEXT,
    suggested_action TEXT,
    resolution TEXT DEFAULT 'pending',
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_record_batch ON record(batch_id);
CREATE INDEX IF NOT EXISTS idx_record_status ON record(status);
CREATE INDEX IF NOT EXISTS idx_record_lc_number ON record(lc_number);
CREATE INDEX IF NOT EXISTS idx_conflict_record ON conflict(record_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution ON conflict(resolution);
"""


def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
