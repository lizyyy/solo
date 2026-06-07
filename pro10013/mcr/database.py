import sqlite3
import json
from typing import List, Optional, Dict, Any
from contextlib import contextmanager
from datetime import datetime

from .models import CollateralRecord, ImportBatch, ReviewHistory


class Database:
    def __init__(self, db_path: str = "mcr.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_db(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
                CREATE TABLE IF NOT EXISTS collateral_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT,
                    client_id TEXT NOT NULL,
                    client_name TEXT,
                    account_id TEXT,
                    collateral_code TEXT,
                    collateral_name TEXT,
                    collateral_type TEXT,
                    quantity REAL,
                    market_value REAL,
                    collateral_ratio REAL,
                    available_collateral REAL,
                    trade_date TEXT,
                    settlement_date TEXT,
                    is_refund INTEGER DEFAULT 0,
                    source_system TEXT,
                    status TEXT DEFAULT 'pending',
                    skip_reason TEXT,
                    skip_detail TEXT,
                    review_result TEXT,
                    review_comment TEXT,
                    reviewer TEXT,
                    review_time TEXT,
                    is_manual_overridden INTEGER DEFAULT 0,
                    previous_review_comment TEXT,
                    raw_data TEXT,
                    created_at TEXT,
                    updated_at TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_batch_id ON collateral_records(batch_id);
                CREATE INDEX IF NOT EXISTS idx_client_id ON collateral_records(client_id);
                CREATE INDEX IF NOT EXISTS idx_status ON collateral_records(status);
                CREATE INDEX IF NOT EXISTS idx_skip_reason ON collateral_records(skip_reason);
                CREATE INDEX IF NOT EXISTS idx_is_refund ON collateral_records(is_refund);
                
                CREATE TABLE IF NOT EXISTS import_batches (
                    batch_id TEXT PRIMARY KEY,
                    file_name TEXT,
                    total_count INTEGER DEFAULT 0,
                    processed_count INTEGER DEFAULT 0,
                    skipped_count INTEGER DEFAULT 0,
                    normal_count INTEGER DEFAULT 0,
                    need_review_count INTEGER DEFAULT 0,
                    created_at TEXT,
                    import_user TEXT,
                    skip_reason_summary TEXT
                );
                
                CREATE TABLE IF NOT EXISTS review_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id INTEGER,
                    batch_id TEXT,
                    old_status TEXT,
                    new_status TEXT,
                    old_review_result TEXT,
                    new_review_result TEXT,
                    old_review_comment TEXT,
                    new_review_comment TEXT,
                    operator TEXT,
                    operation_type TEXT,
                    operation_time TEXT,
                    remark TEXT
                );
                
                CREATE INDEX IF NOT EXISTS idx_history_record_id ON review_history(record_id);
                CREATE INDEX IF NOT EXISTS idx_history_batch_id ON review_history(batch_id);
            """)

    def insert_record(self, record: CollateralRecord) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            raw_data_json = json.dumps(record.raw_data, ensure_ascii=False) if record.raw_data else None
            cursor.execute("""
                INSERT INTO collateral_records (
                    batch_id, client_id, client_name, account_id, collateral_code,
                    collateral_name, collateral_type, quantity, market_value,
                    collateral_ratio, available_collateral, trade_date, settlement_date,
                    is_refund, source_system, status, skip_reason, skip_detail,
                    review_result, review_comment, reviewer, review_time,
                    is_manual_overridden, previous_review_comment, raw_data,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.batch_id, record.client_id, record.client_name, record.account_id,
                record.collateral_code, record.collateral_name, record.collateral_type,
                record.quantity, record.market_value, record.collateral_ratio,
                record.available_collateral, record.trade_date, record.settlement_date,
                1 if record.is_refund else 0, record.source_system, record.status,
                record.skip_reason, record.skip_detail, record.review_result,
                record.review_comment, record.reviewer, record.review_time,
                1 if record.is_manual_overridden else 0, record.previous_review_comment,
                raw_data_json, record.created_at, record.updated_at
            ))
            return cursor.lastrowid

    def batch_insert_records(self, records: List[CollateralRecord]) -> List[int]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            ids = []
            for record in records:
                raw_data_json = json.dumps(record.raw_data, ensure_ascii=False) if record.raw_data else None
                cursor.execute("""
                    INSERT INTO collateral_records (
                        batch_id, client_id, client_name, account_id, collateral_code,
                        collateral_name, collateral_type, quantity, market_value,
                        collateral_ratio, available_collateral, trade_date, settlement_date,
                        is_refund, source_system, status, skip_reason, skip_detail,
                        review_result, review_comment, reviewer, review_time,
                        is_manual_overridden, previous_review_comment, raw_data,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    record.batch_id, record.client_id, record.client_name, record.account_id,
                    record.collateral_code, record.collateral_name, record.collateral_type,
                    record.quantity, record.market_value, record.collateral_ratio,
                    record.available_collateral, record.trade_date, record.settlement_date,
                    1 if record.is_refund else 0, record.source_system, record.status,
                    record.skip_reason, record.skip_detail, record.review_result,
                    record.review_comment, record.reviewer, record.review_time,
                    1 if record.is_manual_overridden else 0, record.previous_review_comment,
                    raw_data_json, record.created_at, record.updated_at
                ))
                ids.append(cursor.lastrowid)
            return ids

    def get_record(self, record_id: int) -> Optional[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM collateral_records WHERE id = ?", (record_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_record(row)
            return None

    def get_records_by_batch(self, batch_id: str) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM collateral_records WHERE batch_id = ? ORDER BY id", (batch_id,))
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_records_by_status(self, status: str, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if batch_id:
                cursor.execute(
                    "SELECT * FROM collateral_records WHERE status = ? AND batch_id = ? ORDER BY id",
                    (status, batch_id)
                )
            else:
                cursor.execute(
                    "SELECT * FROM collateral_records WHERE status = ? ORDER BY id",
                    (status,)
                )
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_records_by_skip_reason(self, skip_reason: str, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if batch_id:
                cursor.execute(
                    "SELECT * FROM collateral_records WHERE skip_reason = ? AND batch_id = ? ORDER BY id",
                    (skip_reason, batch_id)
                )
            else:
                cursor.execute(
                    "SELECT * FROM collateral_records WHERE skip_reason = ? ORDER BY id",
                    (skip_reason,)
                )
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_multi_account_clients(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if batch_id:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE skip_reason = 'multi_account' AND batch_id = ?
                    ORDER BY client_id, account_id
                """, (batch_id,))
            else:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE skip_reason = 'multi_account'
                    ORDER BY client_id, account_id
                """)
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_cross_settlement_refunds(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if batch_id:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE skip_reason = 'cross_settlement_refund' AND batch_id = ?
                    ORDER BY id
                """, (batch_id,))
            else:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE skip_reason = 'cross_settlement_refund'
                    ORDER BY id
                """)
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_manual_overridden_records(self, batch_id: Optional[str] = None) -> List[CollateralRecord]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if batch_id:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE is_manual_overridden = 1 AND batch_id = ?
                    ORDER BY id
                """, (batch_id,))
            else:
                cursor.execute("""
                    SELECT * FROM collateral_records
                    WHERE is_manual_overridden = 1
                    ORDER BY id
                """)
            rows = cursor.fetchall()
            return [self._row_to_record(row) for row in rows]

    def update_record(self, record_id: int, updates: Dict[str, Any]) -> bool:
        if not updates:
            return False
        updates["updated_at"] = datetime.now().isoformat()
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        values = list(updates.values()) + [record_id]
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(f"UPDATE collateral_records SET {set_clause} WHERE id = ?", values)
            return cursor.rowcount > 0

    def add_review_history(self, history: ReviewHistory) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO review_history (
                    record_id, batch_id, old_status, new_status, old_review_result,
                    new_review_result, old_review_comment, new_review_comment,
                    operator, operation_type, operation_time, remark
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                history.record_id, history.batch_id, history.old_status,
                history.new_status, history.old_review_result, history.new_review_result,
                history.old_review_comment, history.new_review_comment,
                history.operator, history.operation_type, history.operation_time,
                history.remark
            ))
            return cursor.lastrowid

    def get_review_history(self, record_id: Optional[int] = None, batch_id: Optional[str] = None) -> List[ReviewHistory]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM review_history WHERE 1=1"
            params = []
            if record_id:
                query += " AND record_id = ?"
                params.append(record_id)
            if batch_id:
                query += " AND batch_id = ?"
                params.append(batch_id)
            query += " ORDER BY operation_time DESC"
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [
                ReviewHistory(
                    id=row["id"],
                    record_id=row["record_id"],
                    batch_id=row["batch_id"],
                    old_status=row["old_status"],
                    new_status=row["new_status"],
                    old_review_result=row["old_review_result"],
                    new_review_result=row["new_review_result"],
                    old_review_comment=row["old_review_comment"],
                    new_review_comment=row["new_review_comment"],
                    operator=row["operator"],
                    operation_type=row["operation_type"],
                    operation_time=row["operation_time"],
                    remark=row["remark"]
                ) for row in rows
            ]

    def insert_batch(self, batch: ImportBatch) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            skip_reason_json = json.dumps(batch.skip_reason_summary, ensure_ascii=False) if batch.skip_reason_summary else None
            cursor.execute("""
                INSERT OR REPLACE INTO import_batches (
                    batch_id, file_name, total_count, processed_count, skipped_count,
                    normal_count, need_review_count, created_at, import_user, skip_reason_summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                batch.batch_id, batch.file_name, batch.total_count, batch.processed_count,
                batch.skipped_count, batch.normal_count, batch.need_review_count,
                batch.created_at, batch.import_user, skip_reason_json
            ))

    def get_batch(self, batch_id: str) -> Optional[ImportBatch]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM import_batches WHERE batch_id = ?", (batch_id,))
            row = cursor.fetchone()
            if row:
                skip_reason_summary = json.loads(row["skip_reason_summary"]) if row["skip_reason_summary"] else None
                return ImportBatch(
                    batch_id=row["batch_id"],
                    file_name=row["file_name"],
                    total_count=row["total_count"],
                    processed_count=row["processed_count"],
                    skipped_count=row["skipped_count"],
                    normal_count=row["normal_count"],
                    need_review_count=row["need_review_count"],
                    created_at=row["created_at"],
                    import_user=row["import_user"],
                    skip_reason_summary=skip_reason_summary
                )
            return None

    def get_all_batches(self) -> List[ImportBatch]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM import_batches ORDER BY created_at DESC")
            rows = cursor.fetchall()
            batches = []
            for row in rows:
                skip_reason_summary = json.loads(row["skip_reason_summary"]) if row["skip_reason_summary"] else None
                batches.append(ImportBatch(
                    batch_id=row["batch_id"],
                    file_name=row["file_name"],
                    total_count=row["total_count"],
                    processed_count=row["processed_count"],
                    skipped_count=row["skipped_count"],
                    normal_count=row["normal_count"],
                    need_review_count=row["need_review_count"],
                    created_at=row["created_at"],
                    import_user=row["import_user"],
                    skip_reason_summary=skip_reason_summary
                ))
            return batches

    def _row_to_record(self, row: sqlite3.Row) -> CollateralRecord:
        raw_data = json.loads(row["raw_data"]) if row["raw_data"] else None
        return CollateralRecord(
            id=row["id"],
            batch_id=row["batch_id"],
            client_id=row["client_id"],
            client_name=row["client_name"],
            account_id=row["account_id"],
            collateral_code=row["collateral_code"],
            collateral_name=row["collateral_name"],
            collateral_type=row["collateral_type"],
            quantity=row["quantity"],
            market_value=row["market_value"],
            collateral_ratio=row["collateral_ratio"],
            available_collateral=row["available_collateral"],
            trade_date=row["trade_date"],
            settlement_date=row["settlement_date"],
            is_refund=bool(row["is_refund"]),
            source_system=row["source_system"],
            status=row["status"],
            skip_reason=row["skip_reason"],
            skip_detail=row["skip_detail"],
            review_result=row["review_result"],
            review_comment=row["review_comment"],
            reviewer=row["reviewer"],
            review_time=row["review_time"],
            is_manual_overridden=bool(row["is_manual_overridden"]),
            previous_review_comment=row["previous_review_comment"],
            raw_data=raw_data,
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )
