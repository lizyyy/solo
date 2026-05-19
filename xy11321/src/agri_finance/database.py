import sqlite3
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from contextlib import contextmanager

from .models import (
    JobRecord, FuelRecord, RateTable, BadRecord,
    BillingRecord, ImportBatch, RecordStatus, ImportSource
)


DB_PATH = Path.home() / ".agri_finance" / "finance.db"


@contextmanager
def get_db_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT UNIQUE NOT NULL,
                source_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                total_records INTEGER DEFAULT 0,
                valid_records INTEGER DEFAULT 0,
                invalid_records INTEGER DEFAULT 0,
                imported_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS job_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                tractor_id TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                operator_name TEXT,
                job_date TIMESTAMP NOT NULL,
                work_hours REAL,
                work_mu REAL,
                fuel_used REAL,
                billing_type TEXT DEFAULT 'mixed',
                status TEXT DEFAULT 'pending',
                raw_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id),
                UNIQUE(batch_id, row_number)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fuel_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                tractor_id TEXT NOT NULL,
                fuel_date TIMESTAMP NOT NULL,
                fuel_amount REAL NOT NULL,
                fuel_unit TEXT DEFAULT 'L',
                status TEXT DEFAULT 'pending',
                raw_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id),
                UNIQUE(batch_id, row_number)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rate_tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tractor_id TEXT NOT NULL,
                effective_date TIMESTAMP NOT NULL,
                hourly_rate REAL DEFAULT 0,
                mu_rate REAL DEFAULT 0,
                fuel_rate REAL DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tractor_id, effective_date)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bad_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                source_type TEXT NOT NULL,
                row_number INTEGER NOT NULL,
                raw_data TEXT NOT NULL,
                error_message TEXT NOT NULL,
                suggestion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS billing_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_record_id INTEGER NOT NULL,
                batch_id TEXT NOT NULL,
                tractor_id TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                operator_name TEXT,
                job_date TIMESTAMP NOT NULL,
                hourly_charge REAL DEFAULT 0,
                mu_charge REAL DEFAULT 0,
                fuel_charge REAL DEFAULT 0,
                total_charge REAL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                reviewed_by TEXT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_record_id) REFERENCES job_records(id),
                UNIQUE(job_record_id)
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_batch ON job_records(batch_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_tractor ON job_records(tractor_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_job_date ON job_records(job_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_billing_batch ON billing_records(batch_id)")
        
        conn.commit()


def compute_file_hash(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def check_duplicate_import(file_hash: str, source_type: ImportSource) -> Optional[ImportBatch]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM import_batches WHERE file_hash = ? AND source_type = ?",
            (file_hash, source_type.value)
        )
        row = cursor.fetchone()
        if row:
            return ImportBatch(**dict(row))
    return None


def create_import_batch(batch: ImportBatch) -> ImportBatch:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO import_batches 
            (batch_id, source_type, file_name, file_hash, total_records, 
             valid_records, invalid_records, imported_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            batch.batch_id, batch.source_type.value, batch.file_name,
            batch.file_hash, batch.total_records, batch.valid_records,
            batch.invalid_records, batch.imported_by
        ))
        conn.commit()
        batch.id = cursor.lastrowid
    return batch


def save_job_records(records: List[JobRecord]) -> List[int]:
    ids = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for rec in records:
            import json
            cursor.execute("""
                INSERT OR REPLACE INTO job_records 
                (batch_id, row_number, tractor_id, operator_id, operator_name,
                 job_date, work_hours, work_mu, fuel_used, billing_type, status, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec.batch_id, rec.row_number, rec.tractor_id, rec.operator_id,
                rec.operator_name, rec.job_date.isoformat(), rec.work_hours,
                rec.work_mu, rec.fuel_used, rec.billing_type.value,
                rec.status.value, json.dumps(rec.raw_data)
            ))
            ids.append(cursor.lastrowid)
        conn.commit()
    return ids


def save_fuel_records(records: List[FuelRecord]) -> List[int]:
    ids = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for rec in records:
            import json
            cursor.execute("""
                INSERT OR REPLACE INTO fuel_records 
                (batch_id, row_number, tractor_id, fuel_date, fuel_amount, 
                 fuel_unit, status, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec.batch_id, rec.row_number, rec.tractor_id,
                rec.fuel_date.isoformat(), rec.fuel_amount,
                rec.fuel_unit, rec.status.value, json.dumps(rec.raw_data)
            ))
            ids.append(cursor.lastrowid)
        conn.commit()
    return ids


def save_bad_records(records: List[BadRecord]) -> List[int]:
    ids = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        for rec in records:
            import json
            cursor.execute("""
                INSERT INTO bad_records 
                (batch_id, source_type, row_number, raw_data, error_message, suggestion)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                rec.batch_id, rec.source_type.value, rec.row_number,
                json.dumps(rec.raw_data), rec.error_message, rec.suggestion
            ))
            ids.append(cursor.lastrowid)
        conn.commit()
    return ids


def get_pending_job_records() -> List[JobRecord]:
    import json
    records = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM job_records WHERE status = ?",
            (RecordStatus.PENDING.value,)
        )
        for row in cursor.fetchall():
            data = dict(row)
            data['raw_data'] = json.loads(data['raw_data'])
            records.append(JobRecord(**data))
    return records


def get_rate_for_tractor(tractor_id: str, job_date: datetime) -> Optional[RateTable]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM rate_tables 
            WHERE tractor_id = ? AND effective_date <= ? AND is_active = 1
            ORDER BY effective_date DESC LIMIT 1
        """, (tractor_id, job_date.isoformat()))
        row = cursor.fetchone()
        if row:
            return RateTable(**dict(row))
    return None


def save_billing_record(record: BillingRecord) -> int:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO billing_records 
            (job_record_id, batch_id, tractor_id, operator_id, operator_name,
             job_date, hourly_charge, mu_charge, fuel_charge, total_charge, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.job_record_id, record.batch_id, record.tractor_id,
            record.operator_id, record.operator_name, record.job_date.isoformat(),
            record.hourly_charge, record.mu_charge, record.fuel_charge,
            record.total_charge, record.status.value
        ))
        conn.commit()
        return cursor.lastrowid


def update_job_record_status(job_id: int, status: RecordStatus):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE job_records SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (status.value, job_id))
        conn.commit()


def get_billing_records(status: Optional[RecordStatus] = None) -> List[BillingRecord]:
    records = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if status:
            cursor.execute(
                "SELECT * FROM billing_records WHERE status = ? ORDER BY job_date",
                (status.value,)
            )
        else:
            cursor.execute("SELECT * FROM billing_records ORDER BY job_date")
        for row in cursor.fetchall():
            records.append(BillingRecord(**dict(row)))
    return records


def review_billing_record(billing_id: int, reviewer: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE billing_records 
            SET status = 'reviewed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (reviewer, billing_id))
        conn.commit()


def get_import_history(limit: int = 50) -> List[ImportBatch]:
    records = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM import_batches ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        for row in cursor.fetchall():
            records.append(ImportBatch(**dict(row)))
    return records


def get_bad_records(batch_id: Optional[str] = None) -> List[BadRecord]:
    import json
    records = []
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if batch_id:
            cursor.execute(
                "SELECT * FROM bad_records WHERE batch_id = ? ORDER BY row_number",
                (batch_id,)
            )
        else:
            cursor.execute("SELECT * FROM bad_records ORDER BY created_at DESC")
        for row in cursor.fetchall():
            data = dict(row)
            data['raw_data'] = json.loads(data['raw_data'])
            records.append(BadRecord(**data))
    return records


def save_rate_table(rate: RateTable) -> int:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO rate_tables 
            (tractor_id, effective_date, hourly_rate, mu_rate, fuel_rate, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            rate.tractor_id, rate.effective_date.isoformat(),
            rate.hourly_rate, rate.mu_rate, rate.fuel_rate, rate.is_active
        ))
        conn.commit()
        return cursor.lastrowid


init_db()
