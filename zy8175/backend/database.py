import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

from backend.config import DATABASE_PATH, Config


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    Config.ensure_dirs()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS flights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_number TEXT NOT NULL,
            aircraft_registration TEXT,
            aircraft_type TEXT,
            departure_airport TEXT,
            arrival_airport TEXT,
            scheduled_departure_time TEXT,
            actual_departure_time TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS cabin_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id INTEGER,
            aircraft_registration TEXT,
            aircraft_type TEXT,
            cabin_class TEXT NOT NULL,
            seats_count INTEGER NOT NULL,
            meal_capacity INTEGER,
            galley_location TEXT,
            is_original INTEGER DEFAULT 1,
            change_reason TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS meal_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id INTEGER,
            flight_number TEXT,
            order_id TEXT UNIQUE,
            cabin_class TEXT,
            seat_number TEXT,
            meal_type TEXT NOT NULL,
            meal_category TEXT,
            special_meal_code TEXT,
            special_meal_description TEXT,
            is_special INTEGER DEFAULT 0,
            quantity INTEGER DEFAULT 1,
            temperature_type TEXT,
            status TEXT DEFAULT 'ordered',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS seat_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT NOT NULL,
            aircraft_type TEXT,
            cabin_class TEXT,
            seat_range_start TEXT,
            seat_range_end TEXT,
            special_meal_allowed TEXT,
            priority_meal INTEGER DEFAULT 0,
            meal_type_restriction TEXT,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS kitchen_scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id TEXT UNIQUE,
            flight_number TEXT,
            meal_id TEXT,
            meal_type TEXT,
            temperature_type TEXT,
            quantity INTEGER DEFAULT 1,
            scan_time TEXT NOT NULL,
            operator_id TEXT,
            galley_id TEXT,
            container_id TEXT,
            is_duplicate INTEGER DEFAULT 0,
            original_scan_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS loading_confirms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            confirm_id TEXT UNIQUE,
            flight_number TEXT,
            flight_id INTEGER,
            meal_id TEXT,
            meal_type TEXT,
            temperature_type TEXT,
            quantity INTEGER DEFAULT 1,
            loading_time TEXT NOT NULL,
            loader_id TEXT,
            aircraft_position TEXT,
            container_id TEXT,
            galley_compartment TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_number TEXT,
            flight_id INTEGER,
            issue_type TEXT NOT NULL,
            issue_code TEXT,
            severity TEXT DEFAULT 'medium',
            description TEXT,
            related_order_id TEXT,
            related_scan_id TEXT,
            related_confirm_id TEXT,
            is_resolved INTEGER DEFAULT 0,
            resolution_note TEXT,
            resolved_by TEXT,
            resolved_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_number TEXT,
            flight_id INTEGER,
            note_type TEXT,
            related_entity_type TEXT,
            related_entity_id TEXT,
            content TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS meal_matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id INTEGER,
            meal_order_id INTEGER,
            kitchen_scan_id INTEGER,
            loading_confirm_id INTEGER,
            match_status TEXT DEFAULT 'pending',
            temperature_check TEXT,
            window_check TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (flight_id) REFERENCES flights (id),
            FOREIGN KEY (meal_order_id) REFERENCES meal_orders (id),
            FOREIGN KEY (kitchen_scan_id) REFERENCES kitchen_scans (id),
            FOREIGN KEY (loading_confirm_id) REFERENCES loading_confirms (id)
        )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_flights_number ON flights (flight_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_meal_orders_flight ON meal_orders (flight_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_kitchen_scans_flight ON kitchen_scans (flight_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_loading_confirms_flight ON loading_confirms (flight_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_flight ON issues (flight_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_notes_flight ON notes (flight_number)')
        
        conn.commit()


def row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


def rows_to_dict_list(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [row_to_dict(row) for row in rows]
