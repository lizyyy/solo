import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diversion.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS community_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        old_name TEXT NOT NULL,
        new_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(old_name, new_name)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS complaint_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_line_no INTEGER NOT NULL,
        import_batch_id TEXT NOT NULL,
        complaint_no TEXT NOT NULL,
        community_name TEXT NOT NULL,
        community_name_normalized TEXT,
        address TEXT,
        complaint_content TEXT,
        import_time TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'IMPORTED',
        has_alias_conflict INTEGER DEFAULT 0,
        photo_remark TEXT,
        photo_uploaded_by TEXT,
        photo_uploaded_at TEXT,
        summary_note TEXT,
        UNIQUE(complaint_no, import_batch_id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL,
        changed_at TEXT DEFAULT (datetime('now')),
        change_reason TEXT,
        FOREIGN KEY (record_id) REFERENCES complaint_records(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS summary_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        generated_at TEXT DEFAULT (datetime('now')),
        generated_by TEXT NOT NULL,
        content_json TEXT NOT NULL,
        affected_record_ids TEXT,
        remark TEXT
    )
    """)

    conn.commit()
    conn.close()


def log_audit(record_id: int, field_name: str, old_value: Optional[str],
              new_value: Optional[str], changed_by: str, change_reason: str = "",
              changed_at: Optional[str] = None):
    if changed_at is None:
        changed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_conn()
    c = conn.cursor()
    c.execute("""
    INSERT INTO audit_log
    (record_id, field_name, old_value, new_value, changed_by, change_reason, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (record_id, field_name, str(old_value) if old_value is not None else None,
          str(new_value) if new_value is not None else None,
          changed_by, change_reason, changed_at))
    conn.commit()
    conn.close()
