import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'refill.db')


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            id_card TEXT,
            disease_type TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS drugs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            generic_name TEXT,
            specification TEXT,
            unit TEXT,
            unit_price REAL DEFAULT 0,
            manufacturer TEXT,
            category TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS drug_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id INTEGER NOT NULL,
            default_dosage REAL,
            dosage_unit TEXT,
            daily_frequency INTEGER,
            refill_window_days INTEGER DEFAULT 7,
            min_days_remaining INTEGER DEFAULT 3,
            notes TEXT,
            FOREIGN KEY (drug_id) REFERENCES drugs(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS contraindications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id INTEGER NOT NULL,
            contraindicated_drug_id INTEGER NOT NULL,
            description TEXT,
            FOREIGN KEY (drug_id) REFERENCES drugs(id),
            FOREIGN KEY (contraindicated_drug_id) REFERENCES drugs(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id INTEGER UNIQUE NOT NULL,
            stock_quantity REAL DEFAULT 0,
            minimum_stock REAL DEFAULT 0,
            FOREIGN KEY (drug_id) REFERENCES drugs(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sales_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_no TEXT UNIQUE NOT NULL,
            customer_id INTEGER NOT NULL,
            sale_date TEXT NOT NULL,
            total_amount REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sales_record_id INTEGER NOT NULL,
            drug_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            dosage REAL,
            dosage_unit TEXT,
            daily_frequency INTEGER,
            FOREIGN KEY (sales_record_id) REFERENCES sales_records(id),
            FOREIGN KEY (drug_id) REFERENCES drugs(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS contact_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            contact_date TEXT NOT NULL,
            contacted_by TEXT,
            status TEXT,
            notes TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales_records(customer_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_records(sale_date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sale_items_sales ON sale_items(sales_record_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_sale_items_drug ON sale_items(drug_id)')


def reset_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
