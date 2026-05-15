import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path


class Database:
    def __init__(self, db_path: str = "sql_checker.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rule_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL UNIQUE,
                rule_content TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT NOT NULL UNIQUE,
                rule_version TEXT NOT NULL,
                source_file TEXT,
                total_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                fail_count INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_version) REFERENCES rule_versions(version)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL,
                business_no TEXT NOT NULL,
                source_data TEXT NOT NULL,
                status TEXT NOT NULL,
                check_result TEXT,
                errors TEXT,
                corrections TEXT,
                conclusion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES batches(id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_records_business_no ON records(business_no)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_records_batch_id ON records(batch_id)
        """)

        conn.commit()
        conn.close()

    def save_rule_version(self, version: str, rule_content: Dict, description: str = ""):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO rule_versions (version, rule_content, description) VALUES (?, ?, ?)",
            (version, json.dumps(rule_content, ensure_ascii=False), description)
        )
        conn.commit()
        conn.close()

    def get_rule_version(self, version: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rule_versions WHERE version = ?", (version,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "version": row["version"],
                "rule_content": json.loads(row["rule_content"]),
                "description": row["description"],
                "created_at": row["created_at"]
            }
        return None

    def get_latest_rule_version(self) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rule_versions ORDER BY created_at DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "version": row["version"],
                "rule_content": json.loads(row["rule_content"]),
                "description": row["description"],
                "created_at": row["created_at"]
            }
        return None

    def create_batch(self, batch_no: str, rule_version: str, source_file: str = None) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO batches (batch_no, rule_version, source_file, status) VALUES (?, ?, ?, ?)",
            (batch_no, rule_version, source_file, "processing")
        )
        batch_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return batch_id

    def update_batch_status(self, batch_id: int, status: str, total_count: int = None,
                            success_count: int = None, fail_count: int = None, summary: str = None):
        conn = self._get_conn()
        cursor = conn.cursor()

        updates = ["status = ?", "updated_at = CURRENT_TIMESTAMP"]
        params = [status]

        if total_count is not None:
            updates.append("total_count = ?")
            params.append(total_count)
        if success_count is not None:
            updates.append("success_count = ?")
            params.append(success_count)
        if fail_count is not None:
            updates.append("fail_count = ?")
            params.append(fail_count)
        if summary is not None:
            updates.append("summary = ?")
            params.append(summary)

        params.append(batch_id)
        cursor.execute(
            f"UPDATE batches SET {', '.join(updates)} WHERE id = ?",
            params
        )
        conn.commit()
        conn.close()

    def add_record(self, batch_id: int, business_no: str, source_data: Dict,
                   status: str, check_result: Dict = None, errors: List = None,
                   corrections: List = None, conclusion: str = None):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO records (batch_id, business_no, source_data, status,
               check_result, errors, corrections, conclusion)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                batch_id,
                business_no,
                json.dumps(source_data, ensure_ascii=False),
                status,
                json.dumps(check_result or {}, ensure_ascii=False),
                json.dumps(errors or [], ensure_ascii=False),
                json.dumps(corrections or [], ensure_ascii=False),
                conclusion
            )
        )
        record_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return record_id

    def get_batch(self, batch_no: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batches WHERE batch_no = ?", (batch_no,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    def get_batch_records(self, batch_id: int) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM records WHERE batch_id = ? ORDER BY id", (batch_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def get_record_by_business_no(self, business_no: str) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM records WHERE business_no = ? ORDER BY created_at DESC", (business_no,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    def list_batches(self, limit: int = 50) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM batches ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
