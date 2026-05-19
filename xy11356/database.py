import sqlite3
import json
from datetime import datetime
from config import DB_PATH


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            id_card TEXT NOT NULL,
            phone TEXT NOT NULL,
            visit_date TEXT NOT NULL,
            visit_reason TEXT,
            visited_person TEXT,
            status TEXT DEFAULT 'pending',
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_by TEXT,
            updated_at TEXT,
            UNIQUE(id_card, visit_date)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS temporary_plates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            vehicle_type TEXT NOT NULL,
            owner_name TEXT,
            owner_phone TEXT,
            valid_from TEXT NOT NULL,
            valid_to TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_by TEXT,
            updated_at TEXT,
            UNIQUE(plate_number, valid_from, valid_to)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS blacklist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            identifier TEXT NOT NULL,
            reason TEXT NOT NULL,
            added_by TEXT NOT NULL,
            added_at TEXT NOT NULL,
            expires_at TEXT,
            is_active INTEGER DEFAULT 1,
            UNIQUE(type, identifier)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            details TEXT,
            operator TEXT NOT NULL,
            role TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            total_count INTEGER NOT NULL,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'processing',
            operator TEXT NOT NULL,
            role TEXT NOT NULL,
            started_at TEXT NOT NULL,
            completed_at TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batch_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            record_index INTEGER NOT NULL,
            original_data TEXT,
            status TEXT NOT NULL,
            error_message TEXT,
            suggestion TEXT,
            entity_id INTEGER,
            created_at TEXT NOT NULL
        )
    ''')

    conn.commit()
    conn.close()


def log_audit(action, entity_type, entity_id, details, operator, role, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_logs (action, entity_type, entity_id, details, operator, role, timestamp, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (action, entity_type, entity_id, json.dumps(details, ensure_ascii=False),
          operator, role, datetime.now().isoformat(), status))
    conn.commit()
    conn.close()


def create_batch_operation(batch_id, operation_type, total_count, operator, role):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO batch_operations (batch_id, operation_type, total_count, operator, role, started_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (batch_id, operation_type, total_count, operator, role, datetime.now().isoformat()))
    conn.commit()
    conn.close()


def update_batch_operation(batch_id, success_count, failed_count, status):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE batch_operations
        SET success_count = ?, failed_count = ?, status = ?, completed_at = ?
        WHERE batch_id = ?
    ''', (success_count, failed_count, status, datetime.now().isoformat(), batch_id))
    conn.commit()
    conn.close()


def add_batch_record(batch_id, record_index, original_data, status, error_message=None, suggestion=None, entity_id=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO batch_records (batch_id, record_index, original_data, status, error_message, suggestion, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (batch_id, record_index, json.dumps(original_data, ensure_ascii=False), status,
          error_message, suggestion, entity_id, datetime.now().isoformat()))
    conn.commit()
    conn.close()
