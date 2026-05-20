import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum


class RecordStatus(Enum):
    PENDING = "pending"
    MATCHED = "matched"
    DISCREPANCY = "discrepancy"
    APPROVED = "approved"
    REJECTED = "rejected"


class DiscrepancyType(Enum):
    SHORTAGE = "shortage"
    DAMAGE = "damage"
    DUPLICATE = "duplicate"
    OVERCHARGE = "overcharge"
    MISMATCH = "mismatch"


class ReviewAction(Enum):
    APPROVE = "approve"
    REJECT = "reject"
    REVISE = "revise"
    REQUEST_MORE = "request_more"


class Database:
    def __init__(self, db_path: str = "linen_reconciliation.db"):
        self.db_path = db_path
        self.init_database()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS room_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_type TEXT NOT NULL UNIQUE,
                linen_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS washing_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT NOT NULL UNIQUE,
                send_date DATE NOT NULL,
                linen_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                total_amount REAL NOT NULL,
                hotel_remark TEXT,
                factory_remark TEXT,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_duplicate INTEGER DEFAULT 0
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS recovery_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recovery_no TEXT NOT NULL UNIQUE,
                recovery_date DATE NOT NULL,
                linen_type TEXT NOT NULL,
                clean_quantity INTEGER NOT NULL,
                damaged_quantity INTEGER NOT NULL,
                lost_quantity INTEGER NOT NULL,
                damage_reason TEXT,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reconciliation_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT NOT NULL UNIQUE,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                status TEXT DEFAULT 'pending',
                total_washing_quantity INTEGER DEFAULT 0,
                total_recovery_quantity INTEGER DEFAULT 0,
                total_damage INTEGER DEFAULT 0,
                total_shortage INTEGER DEFAULT 0,
                total_amount REAL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reconciliation_details (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id INTEGER NOT NULL,
                linen_type TEXT NOT NULL,
                washing_quantity INTEGER NOT NULL,
                recovery_quantity INTEGER NOT NULL,
                damage_quantity INTEGER NOT NULL,
                shortage_quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                washing_amount REAL NOT NULL,
                shortage_compensation REAL NOT NULL,
                damage_compensation REAL NOT NULL,
                final_amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                discrepancy_type TEXT,
                discrepancy_reason TEXT,
                review_note TEXT,
                reviewed_by TEXT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (batch_id) REFERENCES reconciliation_batches(id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS discrepancy_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detail_id INTEGER NOT NULL,
                discrepancy_type TEXT NOT NULL,
                description TEXT NOT NULL,
                expected_value REAL,
                actual_value REAL,
                difference REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (detail_id) REFERENCES reconciliation_details(id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS review_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                detail_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                previous_status TEXT,
                new_status TEXT,
                note TEXT,
                operator TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (detail_id) REFERENCES reconciliation_details(id)
            )
        ''')

        conn.commit()
        conn.close()


class RoomConfig:
    def __init__(self, db: Database):
        self.db = db

    def add_config(self, room_type: str, linen_type: str, quantity: int, unit_price: float) -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO room_config (room_type, linen_type, quantity, unit_price) VALUES (?, ?, ?, ?)',
            (room_type, linen_type, quantity, unit_price)
        )
        conn.commit()
        config_id = cursor.lastrowid
        conn.close()
        return config_id

    def get_all_configs(self) -> List[Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM room_config ORDER BY room_type, linen_type')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


class WashingRecord:
    def __init__(self, db: Database):
        self.db = db

    def add_record(self, batch_no: str, send_date: str, linen_type: str,
                   quantity: int, unit_price: float, hotel_remark: str = "", factory_remark: str = "") -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        total_amount = quantity * unit_price
        cursor.execute(
            '''INSERT INTO washing_records 
               (batch_no, send_date, linen_type, quantity, unit_price, total_amount, hotel_remark, factory_remark)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (batch_no, send_date, linen_type, quantity, unit_price, total_amount, hotel_remark, factory_remark)
        )
        conn.commit()
        record_id = cursor.lastrowid
        conn.close()
        return record_id

    def get_records_by_date_range(self, start_date: str, end_date: str) -> List[Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM washing_records WHERE send_date BETWEEN ? AND ? ORDER BY send_date, linen_type',
            (start_date, end_date)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


class RecoveryRecord:
    def __init__(self, db: Database):
        self.db = db

    def add_record(self, recovery_no: str, recovery_date: str, linen_type: str,
                   clean_quantity: int, damaged_quantity: int = 0, lost_quantity: int = 0,
                   damage_reason: str = "") -> int:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO recovery_records 
               (recovery_no, recovery_date, linen_type, clean_quantity, damaged_quantity, lost_quantity, damage_reason)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (recovery_no, recovery_date, linen_type, clean_quantity, damaged_quantity, lost_quantity, damage_reason)
        )
        conn.commit()
        record_id = cursor.lastrowid
        conn.close()
        return record_id

    def get_records_by_date_range(self, start_date: str, end_date: str) -> List[Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT * FROM recovery_records WHERE recovery_date BETWEEN ? AND ? ORDER BY recovery_date, linen_type',
            (start_date, end_date)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
