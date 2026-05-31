import sqlite3
import os
from datetime import datetime
from contextlib import contextmanager

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "campus_refund.db")

os.makedirs(DB_DIR, exist_ok=True)


def get_connection() -> sqlite3.Connection:
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


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS payment_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id TEXT NOT NULL,
    card_no TEXT NOT NULL,
    student_name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_time TEXT NOT NULL,
    description TEXT DEFAULT '',
    source TEXT DEFAULT 'manual',
    imported_at TEXT NOT NULL,
    UNIQUE(transaction_id)
);

CREATE TABLE IF NOT EXISTS refund_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    card_no TEXT NOT NULL,
    student_name TEXT NOT NULL,
    refund_amount REAL NOT NULL,
    reason TEXT DEFAULT '',
    applicant TEXT DEFAULT '',
    apply_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    rework_count INTEGER NOT NULL DEFAULT 0,
    rework_reason TEXT DEFAULT '',
    imported_at TEXT NOT NULL,
    UNIQUE(application_no)
);

CREATE TABLE IF NOT EXISTS approval_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT NOT NULL,
    approver TEXT NOT NULL,
    approval_time TEXT NOT NULL,
    approval_result TEXT NOT NULL,
    remarks TEXT DEFAULT '',
    email_subject TEXT DEFAULT '',
    imported_at TEXT NOT NULL,
    FOREIGN KEY(application_no) REFERENCES refund_applications(application_no)
);

CREATE TABLE IF NOT EXISTS manual_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_no TEXT NOT NULL,
    note_content TEXT NOT NULL,
    operator TEXT NOT NULL,
    note_time TEXT NOT NULL,
    note_type TEXT DEFAULT 'general',
    FOREIGN KEY(application_no) REFERENCES refund_applications(application_no)
);

CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    confirmed_by TEXT DEFAULT '',
    confirmed_at TEXT DEFAULT '',
    UNIQUE(batch_no)
);

CREATE TABLE IF NOT EXISTS batch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    application_no TEXT NOT NULL,
    FOREIGN KEY(batch_id) REFERENCES batches(id),
    FOREIGN KEY(application_no) REFERENCES refund_applications(application_no),
    UNIQUE(batch_id, application_no)
);

CREATE TABLE IF NOT EXISTS reconciliation_table (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '校园一卡通退款清算',
    expected_amount REAL NOT NULL,
    actual_amount REAL DEFAULT 0,
    difference REAL DEFAULT 0,
    source TEXT DEFAULT 'manual',
    description TEXT DEFAULT '',
    imported_at TEXT NOT NULL,
    UNIQUE(period, category, source)
);

CREATE TABLE IF NOT EXISTS import_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_type TEXT NOT NULL,
    import_time TEXT NOT NULL,
    record_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    conflict_count INTEGER NOT NULL DEFAULT 0,
    details TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conflict_type TEXT NOT NULL,
    local_table TEXT NOT NULL,
    local_id TEXT NOT NULL,
    local_data TEXT NOT NULL,
    incoming_data TEXT NOT NULL,
    field_differences TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    resolution TEXT DEFAULT '',
    resolved_by TEXT DEFAULT '',
    resolved_at TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
);
"""


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)


def query_db(sql: str, params: tuple = (), one: bool = False):
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone() if one else cursor.fetchall()
        return row


def execute_db(sql: str, params: tuple = ()):
    with get_db() as conn:
        conn.execute(sql, params)
        return conn.total_changes
