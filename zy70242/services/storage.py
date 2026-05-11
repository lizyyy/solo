"""数据存储模块"""

import sqlite3
import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any, Iterator

from .models import (
    DossierCatalog,
    TransferBatch,
    ReceiptRecord,
    TransferStage,
    ReceiptStatus,
    ReturnReason,
    ImportProblem,
    HistoryRecord,
)


DB_FILENAME = "dossier_cli.db"
DATA_DIR = "data"


class Storage:
    """SQLite数据存储"""
    
    def __init__(self, project_path: str):
        self.project_path = project_path
        self.data_path = os.path.join(project_path, DATA_DIR)
        self.db_path = os.path.join(self.data_path, DB_FILENAME)
        self._conn: Optional[sqlite3.Connection] = None
    
    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            os.makedirs(self.data_path, exist_ok=True)
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
            self._init_schema()
        return self._conn
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None
    
    def _init_schema(self):
        c = self.conn.cursor()
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS dossier_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                page_start INTEGER NOT NULL,
                page_end INTEGER NOT NULL,
                page_count INTEGER NOT NULL,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(case_id, item_id)
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS transfer_batch (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL UNIQUE,
                case_id TEXT NOT NULL,
                from_stage TEXT NOT NULL,
                to_stage TEXT NOT NULL,
                total_pages INTEGER NOT NULL,
                dossier_count INTEGER NOT NULL,
                transfer_date TEXT NOT NULL,
                transfer_person TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS receipt_record (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id TEXT NOT NULL UNIQUE,
                batch_id TEXT NOT NULL,
                case_id TEXT NOT NULL,
                receipt_date TEXT NOT NULL,
                receipt_person TEXT NOT NULL,
                received_page_count INTEGER,
                missing_pages TEXT,
                extra_pages TEXT,
                status TEXT DEFAULT 'pending',
                return_reason TEXT,
                return_notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES transfer_batch(batch_id)
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS import_problems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_file TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS check_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                case_id TEXT NOT NULL,
                check_time TEXT NOT NULL,
                passed INTEGER NOT NULL,
                issues_json TEXT NOT NULL,
                FOREIGN KEY (batch_id) REFERENCES transfer_batch(batch_id)
            )
        ''')
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS operation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                operation TEXT NOT NULL,
                success INTEGER NOT NULL,
                details TEXT
            )
        ''')
        
        c.execute('CREATE INDEX IF NOT EXISTS idx_catalog_case_id ON dossier_catalog(case_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_batch_case_id ON transfer_batch(case_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_receipt_batch ON receipt_record(batch_id)')
        
        self.conn.commit()
    
    def exists(self) -> bool:
        return os.path.exists(self.db_path)
    
    def has_data(self) -> bool:
        if not self.exists():
            return False
        c = self.conn.cursor()
        c.execute("SELECT COUNT(*) FROM transfer_batch")
        return c.fetchone()[0] > 0
    
    def save_catalog(self, catalog: DossierCatalog) -> bool:
        c = self.conn.cursor()
        try:
            c.execute('''
                INSERT OR REPLACE INTO dossier_catalog 
                (case_id, item_id, item_name, page_start, page_end, page_count, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                catalog.case_id, catalog.item_id, catalog.item_name,
                catalog.page_start, catalog.page_end, catalog.page_count,
                catalog.notes
            ))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_catalog_by_case(self, case_id: str) -> List[DossierCatalog]:
        c = self.conn.cursor()
        c.execute('''
            SELECT * FROM dossier_catalog WHERE case_id = ? ORDER BY page_start
        ''', (case_id,))
        rows = c.fetchall()
        return [DossierCatalog(**dict(row)) for row in rows]
    
    def save_batch(self, batch: TransferBatch) -> bool:
        c = self.conn.cursor()
        try:
            c.execute('''
                INSERT OR REPLACE INTO transfer_batch
                (batch_id, case_id, from_stage, to_stage, total_pages, dossier_count,
                 transfer_date, transfer_person, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                batch.batch_id, batch.case_id, batch.from_stage, batch.to_stage,
                batch.total_pages, batch.dossier_count, batch.transfer_date,
                batch.transfer_person, batch.status, batch.notes
            ))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_batch(self, batch_id: str) -> Optional[TransferBatch]:
        c = self.conn.cursor()
        c.execute('SELECT * FROM transfer_batch WHERE batch_id = ?', (batch_id,))
        row = c.fetchone()
        if row:
            data = dict(row)
            data['from_stage'] = TransferStage(data['from_stage'])
            data['to_stage'] = TransferStage(data['to_stage'])
            data['status'] = ReceiptStatus(data['status'])
            return TransferBatch(**data)
        return None
    
    def get_all_batches(self) -> List[TransferBatch]:
        c = self.conn.cursor()
        c.execute('SELECT * FROM transfer_batch ORDER BY transfer_date DESC')
        rows = c.fetchall()
        results = []
        for row in rows:
            data = dict(row)
            data['from_stage'] = TransferStage(data['from_stage'])
            data['to_stage'] = TransferStage(data['to_stage'])
            data['status'] = ReceiptStatus(data['status'])
            results.append(TransferBatch(**data))
        return results
    
    def save_receipt(self, receipt: ReceiptRecord) -> bool:
        c = self.conn.cursor()
        try:
            return_reason = receipt.return_reason.value if receipt.return_reason else None
            c.execute('''
                INSERT OR REPLACE INTO receipt_record
                (receipt_id, batch_id, case_id, receipt_date, receipt_person,
                 received_page_count, missing_pages, extra_pages, status,
                 return_reason, return_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                receipt.receipt_id, receipt.batch_id, receipt.case_id,
                receipt.receipt_date, receipt.receipt_person,
                receipt.received_page_count, receipt.missing_pages,
                receipt.extra_pages, receipt.status,
                return_reason, receipt.return_notes
            ))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_receipt_by_batch(self, batch_id: str) -> Optional[ReceiptRecord]:
        c = self.conn.cursor()
        c.execute('SELECT * FROM receipt_record WHERE batch_id = ?', (batch_id,))
        row = c.fetchone()
        if row:
            data = dict(row)
            data['status'] = ReceiptStatus(data['status'])
            if data.get('return_reason'):
                data['return_reason'] = ReturnReason(data['return_reason'])
            return ReceiptRecord(**data)
        return None
    
    def get_all_receipts(self) -> List[ReceiptRecord]:
        c = self.conn.cursor()
        c.execute('SELECT * FROM receipt_record ORDER BY receipt_date DESC')
        rows = c.fetchall()
        results = []
        for row in rows:
            data = dict(row)
            data['status'] = ReceiptStatus(data['status'])
            if data.get('return_reason'):
                data['return_reason'] = ReturnReason(data['return_reason'])
            results.append(ReceiptRecord(**data))
        return results
    
    def save_import_problem(self, problem: ImportProblem, source_type: str, source_file: str) -> bool:
        c = self.conn.cursor()
        try:
            c.execute('''
                INSERT INTO import_problems
                (source_type, source_file, line_number, message, details)
                VALUES (?, ?, ?, ?, ?)
            ''', (source_type, source_file, problem.line_number, problem.message, problem.details))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_import_problems(self, limit: int = 100) -> List[ImportProblem]:
        c = self.conn.cursor()
        c.execute('''
            SELECT source_type, source_file, line_number, message, details, created_at
            FROM import_problems ORDER BY id DESC LIMIT ?
        ''', (limit,))
        rows = c.fetchall()
        return [
            ImportProblem(
                line_number=row['line_number'],
                source=f"{row['source_type']}:{row['source_file']}",
                message=row['message'],
                details=row['details']
            )
            for row in rows
        ]
    
    def save_check_result(self, batch_id: str, case_id: str, passed: bool, issues: List[Dict[str, Any]]) -> bool:
        c = self.conn.cursor()
        try:
            c.execute('''
                INSERT INTO check_results
                (batch_id, case_id, check_time, passed, issues_json)
                VALUES (?, ?, ?, ?, ?)
            ''', (batch_id, case_id, datetime.now().isoformat(), int(passed), json.dumps(issues, ensure_ascii=False)))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_check_results(self) -> List[Dict[str, Any]]:
        c = self.conn.cursor()
        c.execute('''
            SELECT * FROM check_results ORDER BY check_time DESC
        ''')
        rows = c.fetchall()
        results = []
        for row in rows:
            data = dict(row)
            data['issues'] = json.loads(data.pop('issues_json'))
            data['passed'] = bool(data['passed'])
            results.append(data)
        return results
    
    def add_history(self, operation: str, success: bool, details: str) -> bool:
        c = self.conn.cursor()
        try:
            c.execute('''
                INSERT INTO operation_history (operation, success, details)
                VALUES (?, ?, ?)
            ''', (operation, int(success), details))
            self.conn.commit()
            return True
        except Exception:
            self.conn.rollback()
            return False
    
    def get_history(self, limit: int = 100, operation: Optional[str] = None) -> List[HistoryRecord]:
        c = self.conn.cursor()
        if operation:
            c.execute('''
                SELECT timestamp, operation, success, details
                FROM operation_history 
                WHERE operation = ?
                ORDER BY id DESC LIMIT ?
            ''', (operation, limit))
        else:
            c.execute('''
                SELECT timestamp, operation, success, details
                FROM operation_history 
                ORDER BY id DESC LIMIT ?
            ''', (limit,))
        rows = c.fetchall()
        return [
            HistoryRecord(
                timestamp=row['timestamp'],
                operation=row['operation'],
                success=bool(row['success']),
                details=row['details'] or ''
            )
            for row in rows
        ]
    
    def reset(self):
        self.close()
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
