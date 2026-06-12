import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'ledger.db')

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db() as conn:
        c = conn.cursor()
        c.executescript('''
            CREATE TABLE IF NOT EXISTS communities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                alias_id INTEGER,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (alias_id) REFERENCES communities(id)
            );

            CREATE TABLE IF NOT EXISTS patrol_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_row INTEGER,
                community_name TEXT NOT NULL,
                community_id INTEGER,
                travel_mode TEXT,
                trip_count INTEGER,
                low_carbon_score REAL,
                patrol_date TEXT,
                grid_member TEXT,
                import_batch TEXT NOT NULL,
                manual_edited INTEGER DEFAULT 0,
                processing_status TEXT DEFAULT 'imported',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (community_id) REFERENCES communities(id)
            );

            CREATE TABLE IF NOT EXISTS construction_notices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                community_id INTEGER,
                community_name TEXT,
                notice_title TEXT,
                notice_content TEXT,
                notice_date TEXT,
                impact_trip_count INTEGER DEFAULT 0,
                impact_low_carbon_score REAL DEFAULT 0.0,
                added_by TEXT DEFAULT '小付',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (community_id) REFERENCES communities(id)
            );

            CREATE TABLE IF NOT EXISTS operation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                record_id INTEGER,
                old_value TEXT,
                new_value TEXT,
                operator TEXT DEFAULT 'system',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL UNIQUE,
                file_name TEXT,
                record_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS self_check_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_type TEXT NOT NULL,
                check_result TEXT,
                details TEXT,
                passed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        conn.commit()

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
