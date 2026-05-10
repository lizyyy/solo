import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

DEFAULT_DB_PATH = Path.home() / ".parking_migrate.db"


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self._conn: Optional[sqlite3.Connection] = None

    def connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
            self._init_tables()
        return self._conn

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def _init_tables(self):
        conn = self.connect()
        cursor = conn.cursor()
        
        cursor.executescript("""
        CREATE TABLE IF NOT EXISTS monthly_cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_no TEXT UNIQUE NOT NULL,
            owner_name TEXT,
            phone TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT,
            created_by TEXT,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS license_plates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL,
            plate_number TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            effective_from TEXT,
            effective_to TEXT,
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY (card_id) REFERENCES monthly_cards(id)
        );

        CREATE TABLE IF NOT EXISTS parking_spaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL,
            space_no TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            effective_from TEXT,
            effective_to TEXT,
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY (card_id) REFERENCES monthly_cards(id)
        );

        CREATE TABLE IF NOT EXISTS payment_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER NOT NULL,
            payment_no TEXT UNIQUE NOT NULL,
            payment_date TEXT NOT NULL,
            amount REAL,
            duration_days INTEGER NOT NULL,
            original_start_date TEXT,
            original_end_date TEXT,
            status TEXT DEFAULT 'processed',
            source TEXT,
            created_at TEXT,
            created_by TEXT,
            FOREIGN KEY (card_id) REFERENCES monthly_cards(id)
        );

        CREATE TABLE IF NOT EXISTS operation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id INTEGER,
            operation_type TEXT NOT NULL,
            operation_desc TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            source TEXT,
            operator TEXT,
            created_at TEXT NOT NULL,
            requires_review INTEGER DEFAULT 0,
            review_notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_plate_active ON license_plates(plate_number, is_active);
        CREATE INDEX IF NOT EXISTS idx_space_active ON parking_spaces(space_no, is_active);
        CREATE INDEX IF NOT EXISTS idx_payment_no ON payment_records(payment_no);
        CREATE INDEX IF NOT EXISTS idx_history_card ON operation_history(card_id);
        CREATE INDEX IF NOT EXISTS idx_history_time ON operation_history(created_at);
        """)
        
        conn.commit()

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor

    def query(self, sql: str, params: tuple = ()) -> List[sqlite3.Row]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        return cursor.fetchall()

    def query_one(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        results = self.query(sql, params)
        return results[0] if results else None

    def log_operation(
        self,
        card_id: Optional[int],
        operation_type: str,
        operation_desc: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None,
        source: str = "manual",
        operator: str = "system",
        requires_review: bool = False
    ) -> int:
        now = datetime.now().isoformat()
        cursor = self.execute(
            """INSERT INTO operation_history
               (card_id, operation_type, operation_desc, old_value, new_value,
                reason, source, operator, created_at, requires_review)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (card_id, operation_type, operation_desc, old_value, new_value,
             reason, source, operator, now, 1 if requires_review else 0)
        )
        return cursor.lastrowid

    def get_card_by_no(self, card_no: str) -> Optional[sqlite3.Row]:
        return self.query_one(
            "SELECT * FROM monthly_cards WHERE card_no = ?",
            (card_no,)
        )

    def get_active_plate(self, card_id: int) -> Optional[sqlite3.Row]:
        return self.query_one(
            "SELECT * FROM license_plates WHERE card_id = ? AND is_active = 1",
            (card_id,)
        )

    def get_active_space(self, card_id: int) -> Optional[sqlite3.Row]:
        return self.query_one(
            "SELECT * FROM parking_spaces WHERE card_id = ? AND is_active = 1",
            (card_id,)
        )

    def get_payment_by_no(self, payment_no: str) -> Optional[sqlite3.Row]:
        return self.query_one(
            "SELECT * FROM payment_records WHERE payment_no = ?",
            (payment_no,)
        )

    def get_card_payments(self, card_id: int) -> List[sqlite3.Row]:
        return self.query(
            """SELECT * FROM payment_records 
               WHERE card_id = ? 
               ORDER BY original_start_date ASC""",
            (card_id,)
        )

    def get_space_owner(self, space_no: str) -> Optional[sqlite3.Row]:
        return self.query_one(
            """SELECT mc.* FROM monthly_cards mc
               JOIN parking_spaces ps ON ps.card_id = mc.id
               WHERE ps.space_no = ? AND ps.is_active = 1""",
            (space_no,)
        )

    def get_plate_owner(self, plate_number: str) -> Optional[sqlite3.Row]:
        return self.query_one(
            """SELECT mc.* FROM monthly_cards mc
               JOIN license_plates lp ON lp.card_id = mc.id
               WHERE lp.plate_number = ? AND lp.is_active = 1""",
            (plate_number,)
        )

    def list_cards(self) -> List[sqlite3.Row]:
        return self.query("SELECT * FROM monthly_cards ORDER BY card_no")

    def get_history(self, card_id: Optional[int] = None, limit: int = 100) -> List[sqlite3.Row]:
        if card_id:
            return self.query(
                """SELECT * FROM operation_history 
                   WHERE card_id = ? 
                   ORDER BY created_at DESC 
                   LIMIT ?""",
                (card_id, limit)
            )
        return self.query(
            """SELECT * FROM operation_history 
               ORDER BY created_at DESC 
               LIMIT ?""",
            (limit,)
        )

    def get_pending_review(self) -> List[sqlite3.Row]:
        return self.query(
            """SELECT * FROM operation_history 
               WHERE requires_review = 1 
               ORDER BY created_at DESC"""
        )
