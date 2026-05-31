import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'sight_singing.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    voice_part TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    pdf_hash TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    uploaded_by TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score_id INTEGER NOT NULL,
    student_name TEXT NOT NULL,
    voice_part TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    recording_path TEXT,
    recording_exists INTEGER NOT NULL DEFAULT 0,
    manual_confirmed INTEGER NOT NULL DEFAULT 0,
    confirmed_by TEXT DEFAULT '',
    confirmed_at TEXT,
    remark TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (score_id) REFERENCES scores(id)
);

CREATE TABLE IF NOT EXISTS modification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT DEFAULT '',
    operator TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS rehearsal_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    score_id INTEGER NOT NULL,
    summary_date TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (score_id) REFERENCES scores(id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_score ON checkins(score_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON checkins(status);
CREATE INDEX IF NOT EXISTS idx_mod_target ON modification_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_rehearsal_score ON rehearsal_summaries(score_id);
"""


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    conn.close()


def log_modification(target_type, target_id, field_name, old_value, new_value, reason='', operator=''):
    conn = get_db()
    conn.execute(
        "INSERT INTO modification_log (target_type, target_id, field_name, old_value, new_value, reason, operator) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (target_type, target_id, field_name, old_value, new_value, reason, operator)
    )
    conn.commit()
    conn.close()


def record_exists(table, record_id):
    conn = get_db()
    row = conn.execute(f"SELECT id FROM {table} WHERE id = ?", (record_id,)).fetchone()
    conn.close()
    return row is not None
