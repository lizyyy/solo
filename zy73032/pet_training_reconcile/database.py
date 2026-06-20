from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterator


DEFAULT_DB_PATH = Path("data/reconcile.sqlite3")


def connect(db_path: str | Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    if str(db_path) == ":memory:":
        conn = sqlite3.connect(":memory:", check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'medical_form')),
            label TEXT NOT NULL,
            raw_payload TEXT NOT NULL DEFAULT '{}',
            imported_by TEXT NOT NULL DEFAULT '小乔',
            imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            canonical_name TEXT NOT NULL UNIQUE,
            species TEXT NOT NULL DEFAULT '未知',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
            alias_name TEXT NOT NULL,
            source_id INTEGER REFERENCES sources(id),
            linked_record_type TEXT NOT NULL DEFAULT '',
            linked_record_id INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(pet_id, alias_name)
        );

        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_name TEXT NOT NULL,
            pet_id INTEGER REFERENCES pets(id),
            course_name TEXT NOT NULL,
            course_date TEXT NOT NULL,
            duration_min INTEGER NOT NULL,
            trainer TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'withdrawn', 'anomaly')),
            anomaly_reason TEXT NOT NULL DEFAULT '',
            source_id INTEGER NOT NULL REFERENCES sources(id),
            source_row TEXT NOT NULL,
            confirmed_by TEXT NOT NULL DEFAULT '',
            confirmed_at TEXT,
            withdrawn_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS medical_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pet_name TEXT NOT NULL,
            pet_id INTEGER REFERENCES pets(id),
            visit_date TEXT NOT NULL,
            diagnosis TEXT NOT NULL,
            treatment TEXT NOT NULL,
            veterinarian TEXT NOT NULL,
            linked_schedule_id INTEGER REFERENCES schedules(id),
            status TEXT NOT NULL CHECK (status IN ('linked', 'needs_review')),
            anomaly_reason TEXT NOT NULL DEFAULT '',
            source_id INTEGER NOT NULL REFERENCES sources(id),
            source_row TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            operator TEXT NOT NULL DEFAULT '小乔',
            remark TEXT NOT NULL DEFAULT '',
            before_state TEXT NOT NULL,
            after_state TEXT NOT NULL,
            operated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.commit()


def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
