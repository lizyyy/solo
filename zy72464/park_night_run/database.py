import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "park_night_run.db")


def get_db_path() -> str:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    return DB_PATH


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
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


def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS street_boundaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            street_name TEXT NOT NULL UNIQUE,
            boundary_description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_hash TEXT NOT NULL UNIQUE,
            file_name TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP,
            record_count INTEGER DEFAULT 0,
            operator TEXT DEFAULT '阿宁'
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sampling_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_row_number INTEGER,
            batch_id INTEGER,
            point_code TEXT NOT NULL UNIQUE,
            longitude REAL NOT NULL,
            latitude REAL NOT NULL,
            street_name TEXT,
            second_street_name TEXT,
            is_boundary INTEGER DEFAULT 0,
            boundary_review_status TEXT DEFAULT 'pending',
            safety_level TEXT DEFAULT 'unknown',
            lighting_condition TEXT,
            complaint_codes TEXT,
            remark TEXT,
            process_status TEXT DEFAULT 'initial',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES import_batches(id)
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS point_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            point_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_by TEXT DEFAULT '阿宁',
            change_reason TEXT,
            changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (point_id) REFERENCES sampling_points(id) ON DELETE CASCADE
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS rollback_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            point_id INTEGER,
            history_ids TEXT,
            rollback_by TEXT DEFAULT '阿宁',
            rollback_reason TEXT,
            rollback_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sampling_boundary ON sampling_points(is_boundary, boundary_review_status)
        """)
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sampling_street ON sampling_points(street_name)
        """)
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_history_point ON point_history(point_id)
        """)


def record_history(conn: sqlite3.Connection, point_id: int, field_name: str,
                   old_value: Any, new_value: Any, change_reason: str = None,
                   changed_by: str = '阿宁'):
    if old_value == new_value:
        return
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO point_history (point_id, field_name, old_value, new_value, changed_by, change_reason)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (point_id, field_name, str(old_value) if old_value is not None else None,
          str(new_value) if new_value is not None else None, changed_by, change_reason))


def get_point_history(point_id: int) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT * FROM point_history WHERE point_id = ? ORDER BY changed_at DESC, id DESC
        """, (point_id,))
        return [dict(row) for row in cursor.fetchall()]
