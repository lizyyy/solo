import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager


class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.getcwd(), "backup_checker.db")
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    source_dir TEXT NOT NULL,
                    target_dir TEXT NOT NULL,
                    retention_days INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS file_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    path TEXT NOT NULL,
                    is_source INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    modified_at TIMESTAMP NOT NULL,
                    hash_md5 TEXT,
                    hash_sha256 TEXT,
                    scan_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES tasks (id),
                    FOREIGN KEY (scan_id) REFERENCES scans (id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    source_files_count INTEGER DEFAULT 0,
                    target_files_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'running',
                    error_message TEXT,
                    FOREIGN KEY (task_id) REFERENCES tasks (id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS comparisons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id INTEGER NOT NULL,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    missing_in_target INTEGER DEFAULT 0,
                    extra_in_target INTEGER DEFAULT 0,
                    possible_duplicates INTEGER DEFAULT 0,
                    hash_mismatch INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'running',
                    FOREIGN KEY (scan_id) REFERENCES scans (id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS anomalies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    comparison_id INTEGER NOT NULL,
                    anomaly_type TEXT NOT NULL,
                    source_path TEXT,
                    target_path TEXT,
                    details TEXT,
                    manually_confirmed INTEGER DEFAULT 0,
                    confirmed_at TIMESTAMP,
                    confirmed_by TEXT DEFAULT 'manual',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (comparison_id) REFERENCES comparisons (id)
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_records_task_id ON file_records (task_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_records_scan_id ON file_records (scan_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_records_hash ON file_records (hash_md5)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomalies_comparison_id ON anomalies (comparison_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_anomalies_confirmed ON anomalies (manually_confirmed)")
            
            conn.commit()

    def create_task(self, name: str, source_dir: str, target_dir: str, retention_days: int = 0) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO tasks (name, source_dir, target_dir, retention_days, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(name) DO UPDATE SET
                    source_dir = excluded.source_dir,
                    target_dir = excluded.target_dir,
                    retention_days = excluded.retention_days,
                    updated_at = CURRENT_TIMESTAMP
            """, (name, source_dir, target_dir, retention_days))
            conn.commit()
            return cursor.lastrowid

    def get_task(self, task_id: int = None, name: str = None) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if task_id:
                cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            elif name:
                cursor.execute("SELECT * FROM tasks WHERE name = ?", (name,))
            else:
                return None
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_all_tasks(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tasks ORDER BY updated_at DESC")
            return [dict(row) for row in cursor.fetchall()]

    def create_scan(self, task_id: int) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO scans (task_id, status)
                VALUES (?, 'running')
            """, (task_id,))
            conn.commit()
            return cursor.lastrowid

    def update_scan(self, scan_id: int, **kwargs):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            fields = []
            values = []
            for key, value in kwargs.items():
                fields.append(f"{key} = ?")
                values.append(value)
            values.append(scan_id)
            cursor.execute(f"""
                UPDATE scans SET {', '.join(fields)} WHERE id = ?
            """, values)
            conn.commit()

    def get_scan(self, scan_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, t.name as task_name, t.source_dir, t.target_dir
                FROM scans s
                JOIN tasks t ON s.task_id = t.id
                WHERE s.id = ?
            """, (scan_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_recent_scans(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, t.name as task_name
                FROM scans s
                JOIN tasks t ON s.task_id = t.id
                ORDER BY s.started_at DESC
                LIMIT ?
            """, (limit,))
            return [dict(row) for row in cursor.fetchall()]

    def add_file_record(self, scan_id: int, task_id: int, path: str, is_source: bool,
                        filename: str, size: int, modified_at: datetime, 
                        hash_md5: str = None, hash_sha256: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO file_records 
                (scan_id, task_id, path, is_source, filename, size, modified_at, hash_md5, hash_sha256)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (scan_id, task_id, path, 1 if is_source else 0, filename, size, 
                  modified_at.isoformat(), hash_md5, hash_sha256))
            conn.commit()

    def get_file_records(self, scan_id: int, is_source: bool = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if is_source is not None:
                cursor.execute("""
                    SELECT * FROM file_records 
                    WHERE scan_id = ? AND is_source = ?
                """, (scan_id, 1 if is_source else 0))
            else:
                cursor.execute("""
                    SELECT * FROM file_records WHERE scan_id = ?
                """, (scan_id,))
            return [dict(row) for row in cursor.fetchall()]

    def create_comparison(self, scan_id: int) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO comparisons (scan_id, status)
                VALUES (?, 'running')
            """, (scan_id,))
            conn.commit()
            return cursor.lastrowid

    def update_comparison(self, comparison_id: int, **kwargs):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            fields = []
            values = []
            for key, value in kwargs.items():
                fields.append(f"{key} = ?")
                values.append(value)
            values.append(comparison_id)
            cursor.execute(f"""
                UPDATE comparisons SET {', '.join(fields)} WHERE id = ?
            """, values)
            conn.commit()

    def get_comparison(self, comparison_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, s.task_id, s.started_at as scan_started_at, t.name as task_name
                FROM comparisons c
                JOIN scans s ON c.scan_id = s.id
                JOIN tasks t ON s.task_id = t.id
                WHERE c.id = ?
            """, (comparison_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def add_anomaly(self, comparison_id: int, anomaly_type: str, 
                    source_path: str = None, target_path: str = None, details: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO anomalies (comparison_id, anomaly_type, source_path, target_path, details)
                VALUES (?, ?, ?, ?, ?)
            """, (comparison_id, anomaly_type, source_path, target_path, details))
            conn.commit()

    def get_anomalies(self, comparison_id: int = None, 
                      manually_confirmed: bool = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM anomalies WHERE 1=1"
            params = []
            
            if comparison_id:
                query += " AND comparison_id = ?"
                params.append(comparison_id)
            if manually_confirmed is not None:
                query += " AND manually_confirmed = ?"
                params.append(1 if manually_confirmed else 0)
            
            query += " ORDER BY created_at DESC"
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def confirm_anomaly(self, anomaly_id: int, confirmed_by: str = "manual"):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE anomalies 
                SET manually_confirmed = 1, confirmed_at = CURRENT_TIMESTAMP, confirmed_by = ?
                WHERE id = ?
            """, (confirmed_by, anomaly_id))
            conn.commit()

    def get_latest_comparison_for_task(self, task_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.*, s.id as scan_id, s.started_at as scan_started_at
                FROM comparisons c
                JOIN scans s ON c.scan_id = s.id
                WHERE s.task_id = ?
                ORDER BY c.started_at DESC
                LIMIT 1
            """, (task_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
