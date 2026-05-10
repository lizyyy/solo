import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime

DB_PATH = "gift_replacement.db"

def get_db_path():
    return os.path.abspath(DB_PATH)

@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_database():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS live_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                start_time DATETIME,
                end_time DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gift_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT UNIQUE NOT NULL,
                session_id TEXT,
                product_sku TEXT,
                min_amount REAL NOT NULL DEFAULT 0,
                gift_sku TEXT NOT NULL,
                gift_quantity INTEGER NOT NULL DEFAULT 1,
                priority INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES live_sessions(session_id),
                FOREIGN KEY (gift_sku) REFERENCES products(sku)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                session_id TEXT,
                customer_name TEXT,
                customer_phone TEXT,
                total_amount REAL NOT NULL DEFAULT 0,
                refund_amount REAL NOT NULL DEFAULT 0,
                final_amount REAL NOT NULL DEFAULT 0,
                order_time DATETIME,
                status TEXT DEFAULT 'normal',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES live_sessions(session_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                product_sku TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                subtotal REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(order_id),
                FOREIGN KEY (product_sku) REFERENCES products(sku)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                available_qty INTEGER NOT NULL DEFAULT 0,
                reserved_qty INTEGER NOT NULL DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sku) REFERENCES products(sku)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS replacement_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT UNIQUE NOT NULL,
                order_id TEXT NOT NULL,
                request_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(order_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS process_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL,
                request_id TEXT,
                order_id TEXT,
                action TEXT NOT NULL,
                gift_sku TEXT,
                gift_quantity INTEGER,
                decision TEXT NOT NULL,
                reason TEXT,
                processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES replacement_requests(request_id),
                FOREIGN KEY (order_id) REFERENCES orders(order_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id TEXT UNIQUE NOT NULL,
                batch_id TEXT NOT NULL,
                final_decision TEXT NOT NULL,
                finalized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (request_id) REFERENCES replacement_requests(request_id)
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_final ON orders(final_amount)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_requests_order ON replacement_requests(order_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_batch ON process_history(batch_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_order ON process_history(order_id)")

def is_initialized():
    return os.path.exists(get_db_path())
