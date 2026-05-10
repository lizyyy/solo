import sqlite3
import os
from datetime import datetime


class Database:
    def __init__(self, db_path=None):
        if db_path is None:
            db_path = os.path.join(os.getcwd(), "spare_parts.db")
        self.db_path = db_path
        self.conn = None
        self._connect()
        self._init_tables()

    def _connect(self):
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row

    def _init_tables(self):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT,
                unit TEXT,
                min_stock REAL DEFAULT 0,
                max_stock REAL DEFAULT 0,
                current_stock REAL DEFAULT 0,
                safety_stock REAL DEFAULT 0,
                location TEXT,
                description TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS consumption (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                repair_order_id TEXT UNIQUE NOT NULL,
                part_number TEXT NOT NULL,
                quantity REAL NOT NULL,
                repair_date TEXT NOT NULL,
                team TEXT,
                equipment TEXT,
                fault_type TEXT,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (part_number) REFERENCES inventory(part_number)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_number TEXT UNIQUE NOT NULL,
                part_number TEXT NOT NULL,
                ordered_quantity REAL NOT NULL,
                received_quantity REAL DEFAULT 0,
                order_date TEXT NOT NULL,
                expected_delivery TEXT,
                actual_delivery TEXT,
                status TEXT DEFAULT 'in_transit',
                supplier TEXT,
                price REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (part_number) REFERENCES inventory(part_number)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS borrows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                borrow_number TEXT UNIQUE NOT NULL,
                part_number TEXT NOT NULL,
                borrowed_quantity REAL NOT NULL,
                returned_quantity REAL DEFAULT 0,
                borrow_date TEXT NOT NULL,
                expected_return TEXT,
                actual_return TEXT,
                from_location TEXT,
                to_location TEXT,
                status TEXT DEFAULT 'borrowed',
                borrower TEXT,
                remarks TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (part_number) REFERENCES inventory(part_number)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_number TEXT NOT NULL,
                change_type TEXT NOT NULL,
                quantity REAL NOT NULL,
                previous_stock REAL,
                new_stock REAL,
                reference_id TEXT,
                reference_type TEXT,
                operator TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                remarks TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS approvals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference_id TEXT NOT NULL,
                reference_type TEXT NOT NULL,
                action TEXT NOT NULL,
                decision TEXT NOT NULL,
                reasons TEXT,
                operator TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS exceptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                exception_type TEXT NOT NULL,
                part_number TEXT,
                reference_id TEXT,
                message TEXT,
                details TEXT,
                status TEXT DEFAULT 'open',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                resolved_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS restock_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_number TEXT NOT NULL,
                suggested_quantity REAL NOT NULL,
                reason TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (part_number) REFERENCES inventory(part_number)
            )
        ''')
        
        self.conn.commit()

    def close(self):
        if self.conn:
            self.conn.close()

    def execute(self, query, params=None):
        cursor = self.conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor

    def commit(self):
        self.conn.commit()


db = None


def get_db():
    global db
    if db is None:
        db = Database()
    return db
