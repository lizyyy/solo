import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "api_alerts.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_type TEXT NOT NULL,
            filename TEXT NOT NULL,
            import_time DATETIME NOT NULL,
            operator TEXT NOT NULL DEFAULT 'system',
            status TEXT NOT NULL,
            total_records INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            duplicate_count INTEGER DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            notes TEXT,
            parent_session_id INTEGER,
            FOREIGN KEY (parent_session_id) REFERENCES import_sessions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS permission_tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            api_name TEXT NOT NULL,
            api_path TEXT NOT NULL,
            app_key TEXT NOT NULL,
            app_name TEXT NOT NULL,
            permission_level TEXT NOT NULL,
            daily_quota INTEGER,
            monthly_quota INTEGER,
            effective_date DATE,
            expiry_date DATE,
            status TEXT NOT NULL DEFAULT 'active',
            record_hash TEXT NOT NULL,
            import_time DATETIME NOT NULL,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS migration_checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            app_key TEXT NOT NULL,
            migration_task TEXT NOT NULL,
            planned_date DATE,
            actual_date DATE,
            status TEXT NOT NULL DEFAULT 'pending',
            assignee TEXT,
            priority TEXT DEFAULT 'normal',
            dependencies TEXT,
            notes TEXT,
            record_hash TEXT NOT NULL,
            import_time DATETIME NOT NULL,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alert_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            alert_id TEXT NOT NULL,
            api_name TEXT NOT NULL,
            app_key TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            alert_level TEXT NOT NULL,
            threshold_value REAL,
            actual_value REAL,
            alert_time DATETIME NOT NULL,
            acknowledgement_status TEXT DEFAULT 'pending',
            acknowledged_by TEXT,
            acknowledged_time DATETIME,
            resolution_notes TEXT,
            record_hash TEXT NOT NULL,
            import_time DATETIME NOT NULL,
            is_deleted BOOLEAN DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_confirmations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            reference_type TEXT NOT NULL,
            reference_id INTEGER NOT NULL,
            confirmation_type TEXT NOT NULL,
            confirmed_by TEXT NOT NULL,
            confirmed_time DATETIME NOT NULL,
            confirmation_result TEXT NOT NULL,
            comments TEXT,
            evidence_snapshot TEXT,
            FOREIGN KEY (session_id) REFERENCES import_sessions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            action_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER,
            old_values TEXT,
            new_values TEXT,
            operator TEXT NOT NULL,
            operation_time DATETIME NOT NULL,
            reason TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_permission_hash ON permission_tables(record_hash, is_deleted)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_migration_hash ON migration_checklists(record_hash, is_deleted)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_alert_hash ON alert_records(record_hash, is_deleted)
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_alert_id ON alert_records(alert_id, is_deleted)
    ''')
    
    conn.commit()
    conn.close()
