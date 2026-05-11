import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent.parent / "garbage_scheduler.db"
SCHEMA_VERSION = 2

@contextmanager
def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def get_schema_version(conn):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT version FROM schema_version WHERE id = 1")
        row = cursor.fetchone()
        return row['version'] if row else 0
    except sqlite3.OperationalError:
        return 0

def set_schema_version(conn, version):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY,
            version INTEGER NOT NULL
        )
    """)
    cursor.execute("INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, ?)", (version,))
    conn.commit()

def migrate_v1_to_v2(conn):
    cursor = conn.cursor()
    
    cursor.execute("""
        ALTER TABLE appointments ADD COLUMN amount_due REAL DEFAULT 0
    """)
    cursor.execute("""
        ALTER TABLE appointments ADD COLUMN amount_paid REAL DEFAULT 0
    """)
    cursor.execute("""
        ALTER TABLE appointments ADD COLUMN price_per_cubic REAL DEFAULT 0
    """)
    
    cursor.execute("""
        CREATE TABLE anomalies_new (
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
            FOREIGN KEY (resident_id) REFERENCES residents(id),
            UNIQUE(resident_id, anomaly_type, appointment_id)
        )
    """)
    
    cursor.execute("""
        INSERT OR IGNORE INTO anomalies_new 
        (id, appointment_id, resident_id, anomaly_type, description, severity, is_resolved, resolution, created_at)
        SELECT id, appointment_id, resident_id, anomaly_type, description, severity, is_resolved, resolution, created_at
        FROM anomalies
        GROUP BY resident_id, anomaly_type, COALESCE(appointment_id, 0)
    """)
    
    cursor.execute("DROP TABLE anomalies")
    cursor.execute("ALTER TABLE anomalies_new RENAME TO anomalies")
    
    conn.commit()

def init_db():
    with get_connection() as conn:
        current_version = get_schema_version(conn)
        
        if current_version == 0:
            _create_tables_v2(conn)
            set_schema_version(conn, SCHEMA_VERSION)
        elif current_version == 1:
            migrate_v1_to_v2(conn)
            set_schema_version(conn, SCHEMA_VERSION)
        elif current_version < SCHEMA_VERSION:
            pass

def _create_tables_v2(conn):
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
        amount_due REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        price_per_cubic REAL DEFAULT 0,
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
        FOREIGN KEY (resident_id) REFERENCES residents(id),
        UNIQUE(resident_id, anomaly_type, appointment_id)
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
