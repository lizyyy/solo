import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preaudit.db')

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
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
    with get_conn() as conn:
        c = conn.cursor()
        c.executescript('''
        CREATE TABLE IF NOT EXISTS preaudit_cases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_no TEXT UNIQUE NOT NULL,
            project_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            meeting_minutes TEXT,
            supplementary_note TEXT,
            oral_instruction TEXT,
            current_judgement TEXT,
            current_judgement_note TEXT,
            is_suspended INTEGER DEFAULT 0,
            suspend_reason TEXT,
            rerun_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            material_name TEXT NOT NULL,
            review_spec TEXT,
            construction_spec TEXT,
            spec_mismatch INTEGER DEFAULT 0,
            version_tag INTEGER DEFAULT 1,
            modified_after_submit INTEGER DEFAULT 0,
            submitted_at TEXT,
            modified_at TEXT,
            FOREIGN KEY (case_id) REFERENCES preaudit_cases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS coordinate_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            system_name TEXT NOT NULL,
            origin_x REAL, origin_y REAL, origin_z REAL,
            measured_x REAL, measured_y REAL, measured_z REAL,
            offset_detected INTEGER DEFAULT 0,
            offset_value_x REAL DEFAULT 0,
            offset_value_y REAL DEFAULT 0,
            offset_value_z REAL DEFAULT 0,
            confirmed INTEGER DEFAULT 0,
            FOREIGN KEY (case_id) REFERENCES preaudit_cases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS remark_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            operator TEXT NOT NULL,
            changed_at TEXT NOT NULL,
            change_note TEXT,
            FOREIGN KEY (case_id) REFERENCES preaudit_cases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS judgement_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            old_judgement TEXT,
            new_judgement TEXT NOT NULL,
            reason TEXT NOT NULL,
            operator TEXT NOT NULL,
            created_at TEXT NOT NULL,
            rerun_batch INTEGER DEFAULT 0,
            FOREIGN KEY (case_id) REFERENCES preaudit_cases(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS collision_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL,
            system_a TEXT NOT NULL,
            system_b TEXT NOT NULL,
            collision_level TEXT NOT NULL,
            location TEXT,
            resolved INTEGER DEFAULT 0,
            version_tag INTEGER DEFAULT 1,
            FOREIGN KEY (case_id) REFERENCES preaudit_cases(id) ON DELETE CASCADE
        );
        ''')

        try:
            c.execute("ALTER TABLE coordinate_checks ADD COLUMN measured_x REAL")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE coordinate_checks ADD COLUMN measured_y REAL")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE coordinate_checks ADD COLUMN measured_z REAL")
        except sqlite3.OperationalError:
            pass

def now_str():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

def row_to_dict(row):
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}

def rows_to_list(rows):
    return [row_to_dict(r) for r in rows]
