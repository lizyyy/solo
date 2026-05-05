import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'mold_guardian.db')

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def reset_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DROP TABLE IF EXISTS export_records')
    cursor.execute('DROP TABLE IF EXISTS review_records')
    cursor.execute('DROP TABLE IF EXISTS rule_results')
    cursor.execute('DROP TABLE IF EXISTS quality_notes')
    cursor.execute('DROP TABLE IF EXISTS pouring_schedules')
    cursor.execute('DROP TABLE IF EXISTS moisture_inspections')
    cursor.execute('DROP TABLE IF EXISTS oven_temperature_logs')
    cursor.execute('DROP TABLE IF EXISTS sand_mold_orders')
    
    conn.commit()
    conn.close()

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sand_mold_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mold_no TEXT UNIQUE NOT NULL,
            part_name TEXT,
            mold_qty INTEGER,
            material TEXT,
            pouring_temp REAL,
            create_time TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oven_temperature_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            oven_no TEXT NOT NULL,
            batch_no TEXT NOT NULL,
            log_time TEXT NOT NULL,
            temperature REAL,
            target_temp REAL,
            duration_min INTEGER,
            mold_nos TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS moisture_inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mold_no TEXT NOT NULL,
            inspect_time TEXT NOT NULL,
            moisture_content REAL,
            inspector TEXT,
            location TEXT,
            remark TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pouring_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_no TEXT UNIQUE NOT NULL,
            mold_no TEXT NOT NULL,
            furnace_no TEXT NOT NULL,
            planned_start_time TEXT,
            planned_end_time TEXT,
            actual_start_time TEXT,
            actual_end_time TEXT,
            status TEXT DEFAULT 'pending',
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quality_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mold_no TEXT NOT NULL,
            note_time TEXT,
            note_type TEXT,
            content TEXT,
            reporter TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rule_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mold_no TEXT NOT NULL,
            rule_type TEXT NOT NULL,
            rule_name TEXT,
            is_violation INTEGER DEFAULT 0,
            severity TEXT,
            description TEXT,
            raw_data TEXT,
            check_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            result_id INTEGER NOT NULL,
            mold_no TEXT NOT NULL,
            original_verdict TEXT,
            new_verdict TEXT,
            review_note TEXT,
            reviewer TEXT,
            review_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS export_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            export_type TEXT NOT NULL,
            export_time TEXT DEFAULT CURRENT_TIMESTAMP,
            filename TEXT,
            content_hash TEXT
        )
    ''')
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print('Database initialized successfully.')
