import sqlite3
import os
from contextlib import contextmanager

DB_FILE = 'book_consignment.db'


def get_db_path() -> str:
    if os.environ.get('BOOK_CONSIGNMENT_DB'):
        return os.environ['BOOK_CONSIGNMENT_DB']
    return DB_FILE


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db(force: bool = False) -> None:
    db_path = get_db_path()
    if os.path.exists(db_path) and not force:
        raise FileExistsError(f"数据库已存在: {db_path}")
    
    if os.path.exists(db_path):
        os.remove(db_path)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE owners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                split_rate REAL NOT NULL DEFAULT 0.7,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                isbn TEXT,
                title TEXT NOT NULL,
                author TEXT,
                owner_id INTEGER NOT NULL,
                original_price REAL,
                min_price REAL,
                consignment_date TEXT,
                status TEXT NOT NULL DEFAULT 'in_store',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES owners(id),
                UNIQUE(owner_id, isbn, title, consignment_date)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                sale_date TEXT NOT NULL,
                original_sale_price REAL NOT NULL,
                discount REAL NOT NULL DEFAULT 1.0,
                final_sale_price REAL NOT NULL,
                source_file TEXT,
                source_line INTEGER,
                is_trial INTEGER NOT NULL DEFAULT 1,
                batch_id INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books(id),
                FOREIGN KEY (batch_id) REFERENCES settlement_batches(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                return_date TEXT NOT NULL,
                reason TEXT,
                source_file TEXT,
                source_line INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (book_id) REFERENCES books(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                payment_date TEXT NOT NULL,
                method TEXT,
                remark TEXT,
                source_file TEXT,
                source_line INTEGER,
                created_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES owners(id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE settlement_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no TEXT UNIQUE NOT NULL,
                description TEXT,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'trial',
                created_at TEXT NOT NULL,
                confirmed_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE import_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_name TEXT NOT NULL,
                file_hash TEXT NOT NULL,
                import_type TEXT NOT NULL,
                import_time TEXT NOT NULL,
                record_count INTEGER NOT NULL,
                UNIQUE(file_hash)
            )
        ''')
        
        conn.commit()


def db_exists() -> bool:
    return os.path.exists(get_db_path())
