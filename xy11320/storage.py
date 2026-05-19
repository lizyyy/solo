import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum


class RecordStatus(Enum):
    DRAFT = "draft"
    IMPORTED = "imported"
    VALIDATED = "validated"
    REVIEWED = "reviewed"
    REJECTED = "rejected"
    EXPORTED = "exported"


class BillingType(Enum):
    HOURLY = "hourly"
    BY_AREA = "by_area"
    FUEL = "fuel"
    MIXED = "mixed"


class ExceptionType(Enum):
    MISSING_FIELD = "missing_field"
    INVALID_VALUE = "invalid_value"
    DUPLICATE = "duplicate"
    CALCULATION_ERROR = "calculation_error"
    RULE_VIOLATION = "rule_violation"
    IMPORT_ERROR = "import_error"
    REVIEW_ERROR = "review_error"


@dataclass
class WorkRecord:
    id: Optional[int]
    record_no: str
    tractor_no: str
    operator: str
    work_date: str
    work_type: str
    billing_type: str
    hours: Optional[float]
    hourly_rate: Optional[float]
    area: Optional[float]
    area_rate: Optional[float]
    fuel_consumption: Optional[float]
    fuel_price: Optional[float]
    total_amount: float
    status: str
    reviewer: Optional[str]
    review_time: Optional[str]
    review_comment: Optional[str]
    created_at: str
    updated_at: str
    import_batch_id: Optional[str]
    exception_type: Optional[str]
    exception_detail: Optional[str]


@dataclass
class ImportBatch:
    batch_id: str
    file_name: str
    total_count: int
    success_count: int
    failed_count: int
    status: str
    created_by: str
    created_at: str
    completed_at: Optional[str]


@dataclass
class ImportResult:
    batch_id: str
    record_no: str
    success: bool
    exception_type: Optional[str]
    exception_detail: Optional[str]
    record_id: Optional[int]


class DatabaseManager:
    def __init__(self, db_path: str = "agri_finance.db"):
        self.db_path = db_path
        self._init_database()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_database(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS work_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_no TEXT NOT NULL UNIQUE,
                    tractor_no TEXT NOT NULL,
                    operator TEXT NOT NULL,
                    work_date TEXT NOT NULL,
                    work_type TEXT NOT NULL,
                    billing_type TEXT NOT NULL,
                    hours REAL,
                    hourly_rate REAL,
                    area REAL,
                    area_rate REAL,
                    fuel_consumption REAL,
                    fuel_price REAL,
                    total_amount REAL NOT NULL,
                    status TEXT NOT NULL,
                    reviewer TEXT,
                    review_time TEXT,
                    review_comment TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    import_batch_id TEXT,
                    exception_type TEXT,
                    exception_detail TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_batches (
                    batch_id TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    total_count INTEGER NOT NULL,
                    success_count INTEGER NOT NULL DEFAULT 0,
                    failed_count INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL,
                    record_no TEXT NOT NULL,
                    success BOOLEAN NOT NULL,
                    exception_type TEXT,
                    exception_detail TEXT,
                    record_id INTEGER,
                    FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS action_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_type TEXT NOT NULL,
                    record_id INTEGER,
                    batch_id TEXT,
                    operator TEXT NOT NULL,
                    action_time TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY (record_id) REFERENCES work_records(id),
                    FOREIGN KEY (batch_id) REFERENCES import_batches(batch_id)
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_work_records_operator ON work_records(operator)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_work_records_status ON work_records(status)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_work_records_work_date ON work_records(work_date)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_work_records_exception_type ON work_records(exception_type)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_import_results_batch_id ON import_results(batch_id)
            ''')
            
            conn.commit()

    def create_import_batch(self, batch: ImportBatch) -> ImportBatch:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO import_batches 
                (batch_id, file_name, total_count, success_count, failed_count, 
                 status, created_by, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                batch.batch_id, batch.file_name, batch.total_count,
                batch.success_count, batch.failed_count, batch.status,
                batch.created_by, batch.created_at, batch.completed_at
            ))
            conn.commit()
            return batch

    def update_import_batch(self, batch_id: str, success_count: int, failed_count: int, 
                           status: str, completed_at: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE import_batches 
                SET success_count = ?, failed_count = ?, status = ?, completed_at = ?
                WHERE batch_id = ?
            ''', (success_count, failed_count, status, completed_at, batch_id))
            conn.commit()

    def add_import_result(self, result: ImportResult):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO import_results 
                (batch_id, record_no, success, exception_type, exception_detail, record_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                result.batch_id, result.record_no, result.success,
                result.exception_type, result.exception_detail, result.record_id
            ))
            conn.commit()

    def insert_work_record(self, record: WorkRecord) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO work_records (
                    record_no, tractor_no, operator, work_date, work_type,
                    billing_type, hours, hourly_rate, area, area_rate,
                    fuel_consumption, fuel_price, total_amount, status,
                    reviewer, review_time, review_comment, created_at,
                    updated_at, import_batch_id, exception_type, exception_detail
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.record_no, record.tractor_no, record.operator,
                record.work_date, record.work_type, record.billing_type,
                record.hours, record.hourly_rate, record.area, record.area_rate,
                record.fuel_consumption, record.fuel_price, record.total_amount,
                record.status, record.reviewer, record.review_time,
                record.review_comment, record.created_at, record.updated_at,
                record.import_batch_id, record.exception_type, record.exception_detail
            ))
            conn.commit()
            return cursor.lastrowid

    def update_work_record(self, record: WorkRecord):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE work_records SET
                    tractor_no = ?, operator = ?, work_date = ?, work_type = ?,
                    billing_type = ?, hours = ?, hourly_rate = ?, area = ?,
                    area_rate = ?, fuel_consumption = ?, fuel_price = ?,
                    total_amount = ?, status = ?, reviewer = ?, review_time = ?,
                    review_comment = ?, updated_at = ?, exception_type = ?,
                    exception_detail = ?
                WHERE id = ?
            ''', (
                record.tractor_no, record.operator, record.work_date,
                record.work_type, record.billing_type, record.hours,
                record.hourly_rate, record.area, record.area_rate,
                record.fuel_consumption, record.fuel_price, record.total_amount,
                record.status, record.reviewer, record.review_time,
                record.review_comment, record.updated_at, record.exception_type,
                record.exception_detail, record.id
            ))
            conn.commit()

    def get_work_record_by_id(self, record_id: int) -> Optional[WorkRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM work_records WHERE id = ?', (record_id,))
            row = cursor.fetchone()
            return self._row_to_work_record(dict(row)) if row else None

    def get_work_record_by_no(self, record_no: str) -> Optional[WorkRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM work_records WHERE record_no = ?', (record_no,))
            row = cursor.fetchone()
            return self._row_to_work_record(dict(row)) if row else None

    def _row_to_work_record(self, row: Dict) -> WorkRecord:
        return WorkRecord(
            id=row.get('id'),
            record_no=row['record_no'],
            tractor_no=row['tractor_no'],
            operator=row['operator'],
            work_date=row['work_date'],
            work_type=row['work_type'],
            billing_type=row['billing_type'],
            hours=row.get('hours'),
            hourly_rate=row.get('hourly_rate'),
            area=row.get('area'),
            area_rate=row.get('area_rate'),
            fuel_consumption=row.get('fuel_consumption'),
            fuel_price=row.get('fuel_price'),
            total_amount=row['total_amount'],
            status=row['status'],
            reviewer=row.get('reviewer'),
            review_time=row.get('review_time'),
            review_comment=row.get('review_comment'),
            created_at=row['created_at'],
            updated_at=row['updated_at'],
            import_batch_id=row.get('import_batch_id'),
            exception_type=row.get('exception_type'),
            exception_detail=row.get('exception_detail')
        )

    def query_work_records(self, 
                          operator: Optional[str] = None,
                          start_date: Optional[str] = None,
                          end_date: Optional[str] = None,
                          status: Optional[str] = None,
                          exception_type: Optional[str] = None,
                          tractor_no: Optional[str] = None,
                          work_type: Optional[str] = None) -> List[WorkRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM work_records WHERE 1=1'
            params = []
            
            if operator:
                query += ' AND operator = ?'
                params.append(operator)
            if start_date:
                query += ' AND work_date >= ?'
                params.append(start_date)
            if end_date:
                query += ' AND work_date <= ?'
                params.append(end_date)
            if status:
                query += ' AND status = ?'
                params.append(status)
            if exception_type:
                query += ' AND exception_type = ?'
                params.append(exception_type)
            if tractor_no:
                query += ' AND tractor_no = ?'
                params.append(tractor_no)
            if work_type:
                query += ' AND work_type = ?'
                params.append(work_type)
            
            query += ' ORDER BY work_date DESC, id DESC'
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_work_record(dict(row)) for row in rows]

    def get_import_batch(self, batch_id: str) -> Optional[ImportBatch]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM import_batches WHERE batch_id = ?', (batch_id,))
            row = cursor.fetchone()
            if row:
                row_dict = dict(row)
                return ImportBatch(
                    batch_id=row_dict['batch_id'],
                    file_name=row_dict['file_name'],
                    total_count=row_dict['total_count'],
                    success_count=row_dict['success_count'],
                    failed_count=row_dict['failed_count'],
                    status=row_dict['status'],
                    created_by=row_dict['created_by'],
                    created_at=row_dict['created_at'],
                    completed_at=row_dict.get('completed_at')
                )
            return None

    def get_import_results(self, batch_id: str) -> List[ImportResult]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM import_results WHERE batch_id = ?', (batch_id,))
            rows = cursor.fetchall()
            return [
                ImportResult(
                    batch_id=row['batch_id'],
                    record_no=row['record_no'],
                    success=bool(row['success']),
                    exception_type=row.get('exception_type'),
                    exception_detail=row.get('exception_detail'),
                    record_id=row.get('record_id')
                )
                for row in rows
            ]

    def add_action_log(self, action_type: str, operator: str, 
                      record_id: Optional[int] = None,
                      batch_id: Optional[str] = None,
                      details: Optional[Dict] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO action_logs 
                (action_type, record_id, batch_id, operator, action_time, details)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                action_type, record_id, batch_id, operator,
                datetime.now().isoformat(),
                json.dumps(details, ensure_ascii=False) if details else None
            ))
            conn.commit()

    def get_action_logs(self, record_id: Optional[int] = None, 
                       batch_id: Optional[str] = None,
                       action_type: Optional[str] = None) -> List[Dict]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM action_logs WHERE 1=1'
            params = []
            
            if record_id:
                query += ' AND record_id = ?'
                params.append(record_id)
            if batch_id:
                query += ' AND batch_id = ?'
                params.append(batch_id)
            if action_type:
                query += ' AND action_type = ?'
                params.append(action_type)
            
            query += ' ORDER BY action_time DESC'
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
