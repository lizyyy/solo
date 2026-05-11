import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent.parent / "garbage_scheduler.db"

@contextmanager
def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS residents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            building TEXT NOT NULL,
            unit TEXT,
            room TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, building, unit, room)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL UNIQUE,
            capacity_cubic REAL NOT NULL,
            driver_name TEXT,
            is_active INTEGER DEFAULT 1
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id INTEGER NOT NULL,
            appointment_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            volume_cubic REAL NOT NULL,
            payment_status TEXT NOT NULL DEFAULT 'unpaid',
            source TEXT,
            import_batch_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resident_id) REFERENCES residents(id),
            UNIQUE(resident_id, appointment_date, time_slot, volume_cubic)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id INTEGER NOT NULL,
            violation_date TEXT NOT NULL,
            violation_type TEXT NOT NULL,
            description TEXT,
            has_complaint INTEGER DEFAULT 0,
            is_resolved INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resident_id) REFERENCES residents(id)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            schedule_date TEXT NOT NULL,
            sequence INTEGER,
            status TEXT NOT NULL DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS anomalies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            appointment_id INTEGER,
            resident_id INTEGER,
            anomaly_type TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'warning',
            is_resolved INTEGER DEFAULT 0,
            resolution TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id),
            FOREIGN KEY (resident_id) REFERENCES residents(id)
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS import_batches (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            import_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_records INTEGER,
            successful_records INTEGER,
            duplicate_records INTEGER,
            failed_records INTEGER
        )
        """)
        
        conn.commit()
