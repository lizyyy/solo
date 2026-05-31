import sqlite3
import os
from datetime import datetime

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "dcep_verify.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biz_id TEXT UNIQUE NOT NULL,
    person_name TEXT NOT NULL,
    amount REAL NOT NULL,
    subsidy_type TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    primary_source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biz_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_row INTEGER,
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (biz_id) REFERENCES records(biz_id)
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biz_id TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT NOT NULL,
    author TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    biz_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    existing_value TEXT NOT NULL,
    incoming_value TEXT NOT NULL,
    existing_source TEXT NOT NULL,
    incoming_source TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolution TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    att_id TEXT UNIQUE NOT NULL,
    biz_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    total_rows INTEGER,
    inserted INTEGER,
    skipped INTEGER,
    conflicts INTEGER,
    imported_at TEXT NOT NULL
);
"""


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_connection(db_path=None):
    if db_path is None:
        db_path = DB_PATH
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path=None):
    conn = get_connection(db_path)
    conn.executescript(SCHEMA)
    conn.close()


def record_exists(conn, biz_id):
    row = conn.execute("SELECT 1 FROM records WHERE biz_id = ?", (biz_id,)).fetchone()
    return row is not None


def get_record(conn, biz_id):
    row = conn.execute("SELECT * FROM records WHERE biz_id = ?", (biz_id,)).fetchone()
    return dict(row) if row else None


def insert_record(conn, biz_id, person_name, amount, subsidy_type, source_type, source_file, source_row, status="pending"):
    now = _now()
    conn.execute(
        "INSERT INTO records (biz_id, person_name, amount, subsidy_type, status, primary_source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (biz_id, person_name, amount, subsidy_type, status, source_type, now, now),
    )
    fields = {"person_name": person_name, "amount": str(amount), "subsidy_type": subsidy_type}
    for fname, fval in fields.items():
        conn.execute(
            "INSERT INTO source_traces (biz_id, source_type, source_file, source_row, field_name, field_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (biz_id, source_type, source_file, source_row, fname, fval, now),
        )
    return True


def update_record(conn, biz_id, **kwargs):
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [biz_id]
    conn.execute(f"UPDATE records SET {sets} WHERE biz_id = ?", vals)


def insert_note(conn, biz_id, content, source, author=None):
    existing = conn.execute(
        "SELECT 1 FROM notes WHERE biz_id = ? AND content = ? AND source = ?",
        (biz_id, content, source),
    ).fetchone()
    if existing:
        return False
    conn.execute(
        "INSERT INTO notes (biz_id, content, source, author, created_at) VALUES (?, ?, ?, ?, ?)",
        (biz_id, content, source, author, _now()),
    )
    return True


def insert_conflict(conn, biz_id, field_name, existing_value, incoming_value, existing_source, incoming_source, suggestion):
    conn.execute(
        "INSERT INTO conflicts (biz_id, field_name, existing_value, incoming_value, existing_source, incoming_source, suggestion, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (biz_id, field_name, existing_value, incoming_value, existing_source, incoming_source, suggestion, _now()),
    )


def get_conflicts(conn, biz_id=None, resolved_only=False, unresolved_only=True):
    sql = "SELECT * FROM conflicts WHERE 1=1"
    params = []
    if biz_id:
        sql += " AND biz_id = ?"
        params.append(biz_id)
    if resolved_only:
        sql += " AND resolved = 1"
    if unresolved_only:
        sql += " AND resolved = 0"
    sql += " ORDER BY created_at"
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def resolve_conflict(conn, conflict_id, resolution):
    conn.execute(
        "UPDATE conflicts SET resolved = 1, resolution = ? WHERE id = ?",
        (resolution, conflict_id),
    )


def insert_attachment(conn, att_id, biz_id, file_name, file_type, upload_time):
    existing = conn.execute("SELECT 1 FROM attachments WHERE att_id = ?", (att_id,)).fetchone()
    if existing:
        return False
    conn.execute(
        "INSERT INTO attachments (att_id, biz_id, file_name, file_type, upload_time) VALUES (?, ?, ?, ?, ?)",
        (att_id, biz_id, file_name, file_type, upload_time),
    )
    return True


def get_attachments(conn, biz_id):
    return [dict(r) for r in conn.execute("SELECT * FROM attachments WHERE biz_id = ?", (biz_id,)).fetchall()]


def get_notes(conn, biz_id):
    return [dict(r) for r in conn.execute("SELECT * FROM notes WHERE biz_id = ? ORDER BY created_at", (biz_id,)).fetchall()]


def get_source_traces(conn, biz_id):
    return [dict(r) for r in conn.execute("SELECT * FROM source_traces WHERE biz_id = ? ORDER BY created_at", (biz_id,)).fetchall()]


def get_all_records(conn):
    return [dict(r) for r in conn.execute("SELECT * FROM records ORDER BY biz_id").fetchall()]


def insert_import_log(conn, file_name, source_type, total_rows, inserted, skipped, conflicts):
    conn.execute(
        "INSERT INTO import_log (file_name, source_type, total_rows, inserted, skipped, conflicts, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (file_name, source_type, total_rows, inserted, skipped, conflicts, _now()),
    )


def get_import_logs(conn):
    return [dict(r) for r in conn.execute("SELECT * FROM import_log ORDER BY imported_at DESC").fetchall()]


def get_stats(conn):
    total = conn.execute("SELECT COUNT(*) FROM records").fetchone()[0]
    by_status = {}
    for row in conn.execute("SELECT status, COUNT(*) as cnt FROM records GROUP BY status"):
        by_status[row[0]] = row[1]
    unresolved = conn.execute("SELECT COUNT(*) FROM conflicts WHERE resolved = 0").fetchone()[0]
    total_amount = conn.execute("SELECT COALESCE(SUM(amount), 0) FROM records").fetchone()[0]
    return {"total_records": total, "by_status": by_status, "unresolved_conflicts": unresolved, "total_amount": total_amount}
