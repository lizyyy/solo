"""数据库模型和操作"""
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Iterator


class Database:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.path.join(os.getcwd(), "sample_ethics.db")
        self._init_db()

    @contextmanager
    def _get_conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sample_records (
                    id TEXT PRIMARY KEY,
                    sample_code TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    sample_type TEXT,
                    collection_date TEXT,
                    status TEXT DEFAULT 'pending',
                    source_file TEXT,
                    source_batch TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ethics_approvals (
                    id TEXT PRIMARY KEY,
                    approval_number TEXT NOT NULL,
                    title TEXT,
                    principal_investigator TEXT,
                    effective_date TEXT,
                    expiry_date TEXT,
                    status TEXT DEFAULT 'active',
                    source_file TEXT,
                    source_batch TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usage_registrations (
                    id TEXT PRIMARY KEY,
                    sample_id TEXT NOT NULL,
                    ethics_approval_id TEXT NOT NULL,
                    usage_purpose TEXT,
                    usage_date TEXT,
                    operator TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'registered',
                    source_file TEXT,
                    source_batch TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sample_id) REFERENCES sample_records(id),
                    FOREIGN KEY (ethics_approval_id) REFERENCES ethics_approvals(id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS results (
                    id TEXT PRIMARY KEY,
                    sample_id TEXT NOT NULL,
                    ethics_approval_id TEXT NOT NULL,
                    result_type TEXT,
                    result_data TEXT,
                    analysis_date TEXT,
                    operator TEXT,
                    notes TEXT,
                    status TEXT DEFAULT 'recorded',
                    source_file TEXT,
                    source_batch TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (sample_id) REFERENCES sample_records(id),
                    FOREIGN KEY (ethics_approval_id) REFERENCES ethics_approvals(id)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS batch_runs (
                    id TEXT PRIMARY KEY,
                    batch_name TEXT NOT NULL,
                    run_type TEXT NOT NULL,
                    source_file TEXT,
                    total_rows INTEGER DEFAULT 0,
                    processed_rows INTEGER DEFAULT 0,
                    skipped_rows INTEGER DEFAULT 0,
                    needs_manual_review INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'running',
                    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    finished_at TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS skipped_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    original_data TEXT,
                    reason TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS manual_review_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    record_id TEXT NOT NULL,
                    issue TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sample_code ON sample_records(sample_code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_approval_number ON ethics_approvals(approval_number)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_usage_sample ON usage_registrations(sample_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_result_sample ON results(sample_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_batch_name ON batch_runs(batch_name)")

    def batch_exists(self, batch_name: str) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM batch_runs WHERE batch_name = ? LIMIT 1", (batch_name,))
            return cursor.fetchone() is not None

    def get_batch_run(self, batch_name: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM batch_runs WHERE batch_name = ?", (batch_name,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_batch_run(self, batch_name: str, run_type: str, source_file: str) -> str:
        import uuid
        batch_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO batch_runs (id, batch_name, run_type, source_file, status)
                VALUES (?, ?, ?, ?, 'running')
            """, (batch_id, batch_name, run_type, source_file))
        return batch_id

    def complete_batch_run(self, batch_id: str, total_rows: int, processed_rows: int,
                           skipped_rows: int, needs_manual_review: int):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE batch_runs
                SET total_rows = ?, processed_rows = ?, skipped_rows = ?,
                    needs_manual_review = ?, status = 'completed',
                    finished_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (total_rows, processed_rows, skipped_rows, needs_manual_review, batch_id))

    def add_skipped_record(self, batch_id: str, record_type: str, original_data: str, reason: str):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO skipped_records (batch_id, record_type, original_data, reason)
                VALUES (?, ?, ?, ?)
            """, (batch_id, record_type, str(original_data), reason))

    def add_manual_review(self, batch_id: str, record_type: str, record_id: str, issue: str):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO manual_review_records (batch_id, record_type, record_id, issue)
                VALUES (?, ?, ?, ?)
            """, (batch_id, record_type, record_id, issue))

    def get_skipped_records(self, batch_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM skipped_records WHERE batch_id = ? ORDER BY id", (batch_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_manual_review_records(self, batch_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM manual_review_records WHERE batch_id = ? ORDER BY id", (batch_id,))
            return [dict(row) for row in cursor.fetchall()]

    def insert_sample(self, record: Dict[str, Any]) -> str:
        import hashlib
        sample_code = str(record.get("sample_code", record.get("样本编号", "")))
        subject_id = str(record.get("subject_id", record.get("受试者ID", "")))
        record_id = hashlib.sha256(f"{sample_code}_{subject_id}".encode()).hexdigest()[:16]
        
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO sample_records
                (id, sample_code, subject_id, sample_type, collection_date, status, source_file, source_batch, updated_at)
                VALUES (?, ?, ?, ?, ?, 'processed', ?, ?, CURRENT_TIMESTAMP)
            """, (
                record_id,
                sample_code,
                subject_id,
                record.get("sample_type", record.get("样本类型", "")),
                record.get("collection_date", record.get("采集日期", "")),
                record.get("_source_file", ""),
                record.get("_batch_name", "")
            ))
        return record_id

    def insert_ethics_approval(self, record: Dict[str, Any]) -> str:
        import hashlib
        approval_number = str(record.get("approval_number", record.get("伦理批件号", "")))
        record_id = hashlib.sha256(f"{approval_number}".encode()).hexdigest()[:16]
        
        expiry_date = record.get("expiry_date", record.get("到期日期", ""))
        status = "active"
        if expiry_date:
            try:
                expiry = datetime.strptime(str(expiry_date), "%Y-%m-%d").date()
                if expiry < date.today():
                    status = "expired"
            except (ValueError, TypeError):
                pass
        
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO ethics_approvals
                (id, approval_number, title, principal_investigator, effective_date,
                 expiry_date, status, source_file, source_batch, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                record_id,
                approval_number,
                record.get("title", record.get("项目名称", "")),
                record.get("principal_investigator", record.get("主要研究者", "")),
                record.get("effective_date", record.get("生效日期", "")),
                expiry_date,
                status,
                record.get("_source_file", ""),
                record.get("_batch_name", "")
            ))
        return record_id

    def insert_usage_registration(self, record: Dict[str, Any], sample_id: str,
                                   approval_id: str) -> str:
        import hashlib
        usage_purpose = record.get("usage_purpose", record.get("使用用途", ""))
        usage_date = record.get("usage_date", record.get("使用日期", ""))
        record_id = hashlib.sha256(f"{sample_id}_{approval_id}_{usage_purpose}_{usage_date}".encode()).hexdigest()[:16]
        
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO usage_registrations
                (id, sample_id, ethics_approval_id, usage_purpose, usage_date, operator,
                 notes, status, source_file, source_batch, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, CURRENT_TIMESTAMP)
            """, (
                record_id,
                sample_id,
                approval_id,
                usage_purpose,
                usage_date,
                record.get("operator", record.get("操作者", "")),
                record.get("notes", record.get("备注", "")),
                record.get("_source_file", ""),
                record.get("_batch_name", "")
            ))
        return record_id

    def insert_result(self, record: Dict[str, Any], sample_id: str, approval_id: str) -> str:
        import hashlib
        result_type = record.get("result_type", record.get("结果类型", ""))
        analysis_date = record.get("analysis_date", record.get("分析日期", ""))
        record_id = hashlib.sha256(f"{sample_id}_{approval_id}_{result_type}_{analysis_date}".encode()).hexdigest()[:16]
        
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO results
                (id, sample_id, ethics_approval_id, result_type, result_data,
                 analysis_date, operator, notes, status, source_file, source_batch, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, CURRENT_TIMESTAMP)
            """, (
                record_id,
                sample_id,
                approval_id,
                result_type,
                record.get("result_data", record.get("结果数据", "")),
                analysis_date,
                record.get("operator", record.get("操作者", "")),
                record.get("notes", record.get("备注", "")),
                record.get("_source_file", ""),
                record.get("_batch_name", "")
            ))
        return record_id

    def find_sample_by_code(self, sample_code: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sample_records WHERE sample_code = ? LIMIT 1", (sample_code,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def find_approval_by_number(self, approval_number: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ethics_approvals WHERE approval_number = ? LIMIT 1", (approval_number,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_all_samples(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sample_records ORDER BY created_at")
            return [dict(row) for row in cursor.fetchall()]

    def get_all_approvals(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM ethics_approvals ORDER BY created_at")
            return [dict(row) for row in cursor.fetchall()]

    def get_all_usages(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM usage_registrations ORDER BY created_at")
            return [dict(row) for row in cursor.fetchall()]

    def get_all_results(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM results ORDER BY created_at")
            return [dict(row) for row in cursor.fetchall()]

    def get_samples_with_expiring_ethics(self, days_threshold: int = 30) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            today = date.today().isoformat()
            cursor.execute("""
                SELECT sr.*, ea.approval_number, ea.title, ea.expiry_date
                FROM sample_records sr
                JOIN usage_registrations ur ON sr.id = ur.sample_id
                JOIN ethics_approvals ea ON ur.ethics_approval_id = ea.id
                WHERE DATE(ea.expiry_date) >= DATE(?)
                AND DATE(ea.expiry_date) <= DATE(?, '+' || ? || ' days')
                GROUP BY sr.id
                ORDER BY ea.expiry_date ASC
            """, (today, today, days_threshold))
            return [dict(row) for row in cursor.fetchall()]

    def get_samples_with_expired_ethics(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            today = date.today().isoformat()
            cursor.execute("""
                SELECT sr.*, ea.approval_number, ea.title, ea.expiry_date
                FROM sample_records sr
                JOIN usage_registrations ur ON sr.id = ur.sample_id
                JOIN ethics_approvals ea ON ur.ethics_approval_id = ea.id
                WHERE DATE(ea.expiry_date) < DATE(?)
                GROUP BY sr.id
                ORDER BY ea.expiry_date ASC
            """, (today,))
            return [dict(row) for row in cursor.fetchall()]
