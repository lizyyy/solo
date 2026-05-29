import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "desensitize.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    pattern TEXT NOT NULL,
    replacement_template TEXT NOT NULL,
    field_paths TEXT NOT NULL DEFAULT '[]',
    mask_start INTEGER NOT NULL DEFAULT 3,
    mask_end INTEGER NOT NULL DEFAULT 4,
    mask_char TEXT NOT NULL DEFAULT '*',
    is_active INTEGER NOT NULL DEFAULT 0,
    parent_version TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_version TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_fields INTEGER DEFAULT 0,
    inconsistent_count INTEGER DEFAULT 0,
    blocked_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS scan_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    processing_order INTEGER NOT NULL DEFAULT 0,
    field_path TEXT NOT NULL,
    original_value TEXT NOT NULL,
    desensitized_value TEXT NOT NULL,
    expected_value TEXT NOT NULL,
    is_consistent INTEGER NOT NULL DEFAULT 1,
    block_reason TEXT,
    exception_id INTEGER,
    source_location TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES scan_tasks(id)
);

CREATE TABLE IF NOT EXISTS exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_pattern TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'all',
    field_path TEXT,
    expires_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    rule_snapshot TEXT NOT NULL DEFAULT '{}',
    exception_snapshot TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL DEFAULT '{}',
    details TEXT NOT NULL DEFAULT '[]',
    export_format TEXT NOT NULL DEFAULT 'json',
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES scan_tasks(id)
);
"""


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()
