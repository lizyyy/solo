"""数据库模块"""
import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime

from .config import DB_FILENAME


class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.getcwd(), DB_FILENAME)
        self.db_path = db_path

    @contextmanager
    def get_connection(self):
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

    def execute(self, query: str, params: tuple = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor

    def query(self, query: str, params: tuple = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchall()

    def query_one(self, query: str, params: tuple = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            return cursor.fetchone()

    def initialize(self):
        schema = """
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_code TEXT UNIQUE NOT NULL,
            store_name TEXT NOT NULL,
            region TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS medicines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_code TEXT UNIQUE NOT NULL,
            medicine_name TEXT NOT NULL,
            storage_type TEXT NOT NULL DEFAULT 'normal',
            unit TEXT NOT NULL DEFAULT 'box',
            price REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            medicine_id INTEGER NOT NULL,
            batch_no TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            supplier TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id),
            UNIQUE(medicine_id, batch_no)
        );

        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            batch_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            daily_sales_rate REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (store_id) REFERENCES stores(id),
            FOREIGN KEY (batch_id) REFERENCES batches(id),
            UNIQUE(store_id, batch_id)
        );

        CREATE TABLE IF NOT EXISTS allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            allocation_code TEXT UNIQUE NOT NULL,
            source_store_id INTEGER NOT NULL,
            target_store_id INTEGER NOT NULL,
            batch_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            risk_reduction REAL DEFAULT 0,
            source_before_qty INTEGER,
            source_after_qty INTEGER,
            target_before_qty INTEGER,
            target_after_qty INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (source_store_id) REFERENCES stores(id),
            FOREIGN KEY (target_store_id) REFERENCES stores(id),
            FOREIGN KEY (batch_id) REFERENCES batches(id)
        );

        CREATE TABLE IF NOT EXISTS allocation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            allocation_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            operator TEXT NOT NULL,
            before_status TEXT,
            after_status TEXT,
            before_quantity INTEGER,
            after_quantity INTEGER,
            remarks TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (allocation_id) REFERENCES allocations(id)
        );

        CREATE TABLE IF NOT EXISTS constraints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            constraint_type TEXT NOT NULL,
            medicine_id INTEGER,
            store_id INTEGER,
            max_transfer_per_day INTEGER,
            allowed_regions TEXT,
            min_days_before_expiry INTEGER,
            min_daily_sales_rate REAL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (medicine_id) REFERENCES medicines(id),
            FOREIGN KEY (store_id) REFERENCES stores(id)
        );
        """
        with self.get_connection() as conn:
            conn.executescript(schema)

        self._create_indices()
        return True

    def _create_indices(self):
        indices = [
            "CREATE INDEX IF NOT EXISTS idx_stores_region ON stores(region)",
            "CREATE INDEX IF NOT EXISTS idx_medicines_storage ON medicines(storage_type)",
            "CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store_id)",
            "CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(batch_id)",
            "CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status)",
            "CREATE INDEX IF NOT EXISTS idx_allocations_source ON allocations(source_store_id)",
            "CREATE INDEX IF NOT EXISTS idx_allocations_target ON allocations(target_store_id)",
            "CREATE INDEX IF NOT EXISTS idx_history_allocation ON allocation_history(allocation_id)",
        ]
        with self.get_connection() as conn:
            for idx in indices:
                conn.execute(idx)

    def is_initialized(self):
        try:
            self.query("SELECT name FROM sqlite_master WHERE type='table' AND name='stores'")
            return True
        except Exception:
            return False
