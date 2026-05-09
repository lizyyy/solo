import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "avsec.db")

def get_db_path():
    return DB_PATH

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with get_conn() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS aircraft_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                aircraft_type TEXT UNIQUE NOT NULL,
                economy_meals INTEGER DEFAULT 0,
                business_meals INTEGER DEFAULT 0,
                first_class_meals INTEGER DEFAULT 0,
                snacks INTEGER DEFAULT 0,
                beverages INTEGER DEFAULT 0,
                cutlery_sets INTEGER DEFAULT 0,
                blankets INTEGER DEFAULT 0,
                pillows INTEGER DEFAULT 0,
                headsets INTEGER DEFAULT 0,
                amenity_kits INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS special_meal_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flight_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flight_number TEXT UNIQUE NOT NULL,
                aircraft_type TEXT NOT NULL,
                route TEXT NOT NULL,
                scheduled_departure TEXT NOT NULL,
                economy_passengers INTEGER DEFAULT 0,
                business_passengers INTEGER DEFAULT 0,
                first_class_passengers INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                previous_aircraft_type TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS passenger_special_meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flight_number TEXT NOT NULL,
                meal_code TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                passenger_names TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (flight_number) REFERENCES flight_plans(flight_number),
                FOREIGN KEY (meal_code) REFERENCES special_meal_types(code),
                UNIQUE(flight_number, meal_code)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS loading_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flight_number TEXT NOT NULL,
                aircraft_type TEXT NOT NULL,
                plan_version INTEGER DEFAULT 1,
                economy_meals_loaded INTEGER DEFAULT 0,
                business_meals_loaded INTEGER DEFAULT 0,
                first_class_meals_loaded INTEGER DEFAULT 0,
                snacks_loaded INTEGER DEFAULT 0,
                beverages_loaded INTEGER DEFAULT 0,
                cutlery_sets_loaded INTEGER DEFAULT 0,
                blankets_loaded INTEGER DEFAULT 0,
                pillows_loaded INTEGER DEFAULT 0,
                headsets_loaded INTEGER DEFAULT 0,
                amenity_kits_loaded INTEGER DEFAULT 0,
                loader_name TEXT,
                load_time TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (flight_number) REFERENCES flight_plans(flight_number)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS loading_special_meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                loading_record_id INTEGER NOT NULL,
                flight_number TEXT NOT NULL,
                meal_code TEXT NOT NULL,
                loaded_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (loading_record_id) REFERENCES loading_records(id),
                FOREIGN KEY (flight_number) REFERENCES flight_plans(flight_number),
                FOREIGN KEY (meal_code) REFERENCES special_meal_types(code),
                UNIQUE(loading_record_id, meal_code)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                operator TEXT NOT NULL,
                before_data TEXT,
                after_data TEXT,
                timestamp TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS verification_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                flight_number TEXT NOT NULL,
                check_run_id TEXT NOT NULL,
                check_type TEXT NOT NULL,
                status TEXT NOT NULL,
                details TEXT,
                created_at TEXT NOT NULL
            )
        """)
