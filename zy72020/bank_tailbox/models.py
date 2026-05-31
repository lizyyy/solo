import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "tailbox.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS batch (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_file TEXT,
        import_time TEXT NOT NULL,
        notes TEXT,
        record_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        transfer_date TEXT NOT NULL,
        from_branch TEXT NOT NULL,
        to_branch TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'CNY',
        operator TEXT,
        transfer_type TEXT,
        approval_email_ref TEXT,
        voucher_no TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        original_source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_supplement INTEGER DEFAULT 0,
        supplement_batch_id INTEGER,
        FOREIGN KEY (batch_id) REFERENCES batch(id)
    );

    CREATE TABLE IF NOT EXISTS conflict (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        email_value TEXT,
        import_value TEXT,
        import_source TEXT,
        email_source TEXT,
        suggested_action TEXT,
        resolution TEXT,
        resolved_by TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES record(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        operator TEXT,
        source TEXT,
        created_at TEXT NOT NULL
    );
    """)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
