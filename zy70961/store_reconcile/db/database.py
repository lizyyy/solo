from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional


class DatabaseManager:
    _instance: Optional[DatabaseManager] = None

    def __init__(self, db_path: str = "reconcile.db"):
        self.db_path = db_path
        self._init_db()

    @classmethod
    def get_instance(cls, db_path: str = "reconcile.db") -> DatabaseManager:
        if cls._instance is None:
            cls._instance = cls(db_path)
        return cls._instance

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS reconcile_batches (
                    batch_id TEXT PRIMARY KEY,
                    store_id TEXT NOT NULL,
                    batch_date TEXT NOT NULL,
                    upload_time TEXT NOT NULL,
                    status TEXT DEFAULT 'processing',
                    deposit_count INTEGER DEFAULT 0,
                    sales_count INTEGER DEFAULT 0,
                    petty_cash_count INTEGER DEFAULT 0,
                    source_hash TEXT,
                    error_message TEXT,
                    UNIQUE(store_id, batch_date, source_hash)
                );

                CREATE TABLE IF NOT EXISTS reconcile_items (
                    item_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    store_id TEXT NOT NULL,
                    record_date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    category TEXT NOT NULL,
                    deposit_amount REAL,
                    sales_amount REAL,
                    petty_cash_change REAL,
                    difference REAL,
                    raw_record TEXT,
                    suggestion TEXT,
                    error_message TEXT,
                    rule_matched TEXT,
                    FOREIGN KEY (batch_id) REFERENCES reconcile_batches(batch_id)
                );

                CREATE TABLE IF NOT EXISTS petty_cash_ledger (
                    txn_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    store_id TEXT NOT NULL,
                    txn_date TEXT NOT NULL,
                    txn_type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    balance_after REAL DEFAULT 0,
                    reference TEXT,
                    description TEXT,
                    raw_data TEXT,
                    FOREIGN KEY (batch_id) REFERENCES reconcile_batches(batch_id)
                );

                CREATE TABLE IF NOT EXISTS deposits (
                    deposit_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    store_id TEXT NOT NULL,
                    deposit_date TEXT NOT NULL,
                    amount REAL NOT NULL,
                    deposit_method TEXT,
                    reference_no TEXT,
                    raw_data TEXT,
                    FOREIGN KEY (batch_id) REFERENCES reconcile_batches(batch_id)
                );

                CREATE TABLE IF NOT EXISTS sales (
                    sale_id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    store_id TEXT NOT NULL,
                    sale_date TEXT NOT NULL,
                    total_amount REAL NOT NULL,
                    cash_amount REAL DEFAULT 0,
                    pos_amount REAL DEFAULT 0,
                    other_amount REAL DEFAULT 0,
                    transaction_count INTEGER DEFAULT 0,
                    raw_data TEXT,
                    FOREIGN KEY (batch_id) REFERENCES reconcile_batches(batch_id)
                );

                CREATE INDEX IF NOT EXISTS idx_batches_store_date
                    ON reconcile_batches(store_id, batch_date);
                CREATE INDEX IF NOT EXISTS idx_items_batch
                    ON reconcile_items(batch_id);
                CREATE INDEX IF NOT EXISTS idx_ledger_store_date
                    ON petty_cash_ledger(store_id, txn_date);
            """)

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

    def compute_source_hash(
        self,
        deposits: List[Dict[str, Any]],
        sales: List[Dict[str, Any]],
        petty_cash: List[Dict[str, Any]],
    ) -> str:
        content = json.dumps(
            {
                "deposits": sorted(deposits, key=lambda x: str(x)),
                "sales": sorted(sales, key=lambda x: str(x)),
                "petty_cash": sorted(petty_cash, key=lambda x: str(x)),
            },
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def is_batch_processed(
        self, store_id: str, batch_date: str, source_hash: str
    ) -> Optional[str]:
        with self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT batch_id FROM reconcile_batches
                WHERE store_id = ? AND batch_date = ? AND source_hash = ?
                """,
                (store_id, batch_date, source_hash),
            ).fetchone()
            return row["batch_id"] if row else None

    def create_batch(
        self,
        store_id: str,
        batch_date: str,
        deposit_count: int,
        sales_count: int,
        petty_cash_count: int,
        source_hash: str,
    ) -> str:
        batch_id = str(uuid.uuid4())
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO reconcile_batches
                    (batch_id, store_id, batch_date, upload_time, status,
                     deposit_count, sales_count, petty_cash_count, source_hash)
                VALUES (?, ?, ?, ?, 'processing', ?, ?, ?, ?)
                """,
                (
                    batch_id,
                    store_id,
                    batch_date,
                    datetime.now().isoformat(),
                    deposit_count,
                    sales_count,
                    petty_cash_count,
                    source_hash,
                ),
            )
        return batch_id

    def update_batch_status(
        self, batch_id: str, status: str, error_message: Optional[str] = None
    ):
        with self._get_conn() as conn:
            conn.execute(
                """
                UPDATE reconcile_batches
                SET status = ?, error_message = ?
                WHERE batch_id = ?
                """,
                (status, error_message, batch_id),
            )

    def save_deposits(self, batch_id: str, deposits: List[Dict[str, Any]]):
        with self._get_conn() as conn:
            for dep in deposits:
                conn.execute(
                    """
                    INSERT INTO deposits
                        (deposit_id, batch_id, store_id, deposit_date,
                         amount, deposit_method, reference_no, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        batch_id,
                        dep.get("store_id"),
                        dep.get("deposit_date"),
                        dep.get("amount"),
                        dep.get("deposit_method", "cash"),
                        dep.get("reference_no"),
                        json.dumps(dep.get("raw_data", {}), default=str),
                    ),
                )

    def save_sales(self, batch_id: str, sales: List[Dict[str, Any]]):
        with self._get_conn() as conn:
            for sale in sales:
                conn.execute(
                    """
                    INSERT INTO sales
                        (sale_id, batch_id, store_id, sale_date,
                         total_amount, cash_amount, pos_amount,
                         other_amount, transaction_count, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        batch_id,
                        sale.get("store_id"),
                        sale.get("sale_date"),
                        sale.get("total_amount"),
                        sale.get("cash_amount", 0),
                        sale.get("pos_amount", 0),
                        sale.get("other_amount", 0),
                        sale.get("transaction_count", 0),
                        json.dumps(sale.get("raw_data", {}), default=str),
                    ),
                )

    def save_petty_cash(
        self, batch_id: str, records: List[Dict[str, Any]]
    ):
        with self._get_conn() as conn:
            for rec in records:
                conn.execute(
                    """
                    INSERT INTO petty_cash_ledger
                        (txn_id, batch_id, store_id, txn_date, txn_type,
                         amount, balance_after, reference, description, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(uuid.uuid4()),
                        batch_id,
                        rec.get("store_id"),
                        rec.get("txn_date"),
                        rec.get("txn_type"),
                        rec.get("amount"),
                        rec.get("balance_after", 0),
                        rec.get("reference"),
                        rec.get("description"),
                        json.dumps(rec.get("raw_data", {}), default=str),
                    ),
                )

    def save_reconcile_items(
        self, batch_id: str, items: List[Dict[str, Any]]
    ):
        with self._get_conn() as conn:
            for item in items:
                conn.execute(
                    """
                    INSERT INTO reconcile_items
                        (item_id, batch_id, store_id, record_date, status,
                         category, deposit_amount, sales_amount,
                         petty_cash_change, difference, raw_record,
                         suggestion, error_message, rule_matched)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.get("item_id", str(uuid.uuid4())),
                        batch_id,
                        item.get("store_id"),
                        item.get("record_date"),
                        item.get("status"),
                        item.get("category"),
                        item.get("deposit_amount"),
                        item.get("sales_amount"),
                        item.get("petty_cash_change"),
                        item.get("difference"),
                        json.dumps(item.get("raw_record", {}), default=str),
                        item.get("suggestion"),
                        item.get("error_message"),
                        json.dumps(item.get("rule_matched", []), default=str),
                    ),
                )

    def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM reconcile_batches WHERE batch_id = ?",
                (batch_id,),
            ).fetchone()
            return dict(row) if row else None

    def get_batches_by_store(
        self, store_id: str, start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM reconcile_batches WHERE store_id = ?"
            params: List[Any] = [store_id]
            if start_date:
                query += " AND batch_date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND batch_date <= ?"
                params.append(end_date)
            query += " ORDER BY batch_date DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_reconcile_items(
        self, batch_id: str,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM reconcile_items WHERE batch_id = ?"
            params: List[Any] = [batch_id]
            if status:
                query += " AND status = ?"
                params.append(status)
            query += " ORDER BY record_date"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_petty_cash_ledger(
        self, store_id: str, start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = (
                "SELECT pl.*, rb.batch_date as batch_date "
                "FROM petty_cash_ledger pl "
                "JOIN reconcile_batches rb ON pl.batch_id = rb.batch_id "
                "WHERE pl.store_id = ?"
            )
            params: List[Any] = [store_id]
            if start_date:
                query += " AND pl.txn_date >= ?"
                params.append(start_date)
            if end_date:
                query += " AND pl.txn_date <= ?"
                params.append(end_date)
            query += " ORDER BY pl.txn_date ASC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_latest_balance(self, store_id: str, target_date: str) -> Optional[float]:
        with self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT balance_after FROM petty_cash_ledger
                WHERE store_id = ? AND txn_date <= ?
                ORDER BY txn_date DESC, txn_id DESC
                LIMIT 1
                """,
                (store_id, target_date),
            ).fetchone()
            return row["balance_after"] if row else None


def get_db_manager(db_path: str = "reconcile.db") -> DatabaseManager:
    return DatabaseManager.get_instance(db_path)
