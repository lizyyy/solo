import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saas_deferral.db")

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_conn()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS deferral_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        contract_no TEXT NOT NULL,
        subscription_period_start TEXT NOT NULL,
        subscription_period_end TEXT NOT NULL,
        total_amount REAL NOT NULL,
        deferred_amount REAL NOT NULL DEFAULT 0,
        recognized_amount REAL NOT NULL DEFAULT 0,
        source_type TEXT NOT NULL,
        has_voucher INTEGER NOT NULL DEFAULT 0,
        voucher_source TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        contract_scan_note TEXT DEFAULT '',
        imported_data_note TEXT DEFAULT '',
        conflict_detail TEXT DEFAULT '',
        suggestion TEXT DEFAULT '',
        operator_note TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        detail TEXT DEFAULT '',
        operator TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES deferral_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_batch ON deferral_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_records_status ON deferral_records(status);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
    """)
    conn.commit()
    conn.close()

def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def add_audit(record_id: int, action: str, detail: str, operator: str, conn: sqlite3.Connection):
    conn.execute(
        "INSERT INTO audit_log (record_id, action, detail, operator, created_at) VALUES (?, ?, ?, ?, ?)",
        (record_id, action, detail, operator, _now())
    )

def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return dict(row)

STATUS_PENDING = "pending"
STATUS_CONFIRMED = "confirmed"
STATUS_SUSPENDED = "suspended"
STATUS_CONFLICT = "conflict"

VALID_TRANSITIONS = {
    STATUS_PENDING: [STATUS_CONFIRMED, STATUS_SUSPENDED, STATUS_CONFLICT],
    STATUS_SUSPENDED: [STATUS_CONFIRMED],
    STATUS_CONFLICT: [STATUS_CONFIRMED],
    STATUS_CONFIRMED: [],
}
