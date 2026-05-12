import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(".sla_data") / "sla.db"


class Database:
    def __init__(self):
        self._db_path = None
        self._conn = None

    @property
    def db_path(self):
        if self._db_path is None:
            self._db_path = Path(".sla_data") / "sla.db"
            self._db_path.parent.mkdir(parents=True, exist_ok=True)
        return self._db_path

    @property
    def conn(self):
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def commit(self):
        if self._conn:
            self._conn.commit()


db = Database()


def init_database():
    conn = db.conn
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            ticket_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            customer_type TEXT NOT NULL DEFAULT 'NORMAL',
            created_at TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'NORMAL',
            current_queue TEXT,
            current_status TEXT,
            sla_deadline TEXT,
            is_breached INTEGER DEFAULT 0,
            breach_reason TEXT,
            blame_queue TEXT,
            created_by TEXT DEFAULT 'system',
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS status_transitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            from_queue TEXT,
            to_queue TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            transition_time TEXT NOT NULL,
            operator TEXT,
            transition_id TEXT,
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticket_id, transition_id),
            FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS pauses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            pause_start TEXT NOT NULL,
            pause_end TEXT,
            pause_reason TEXT NOT NULL,
            pause_reason_category TEXT,
            operator TEXT,
            pause_id TEXT,
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticket_id, pause_id),
            FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS escalations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            escalation_time TEXT NOT NULL,
            from_level TEXT,
            to_level TEXT NOT NULL,
            from_queue TEXT,
            to_queue TEXT,
            escalation_reason TEXT,
            operator TEXT,
            escalation_id TEXT,
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ticket_id, escalation_id),
            FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sla_breaches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            breached_at TEXT NOT NULL,
            breach_category TEXT NOT NULL,
            blame_queue TEXT NOT NULL,
            blame_reason TEXT,
            calculated_sla_deadline TEXT,
            actual_resolution_time TEXT,
            excluded_periods TEXT,
            active_queues TEXT,
            processing_details TEXT,
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            operator TEXT NOT NULL,
            correction_time TEXT DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_at_ts TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(ticket_id) REFERENCES tickets(ticket_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS holidays (
            date TEXT PRIMARY KEY,
            name TEXT,
            is_weekend INTEGER DEFAULT 0
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS import_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_type TEXT NOT NULL,
            file_path TEXT,
            records_count INTEGER,
            success_count INTEGER,
            failed_count INTEGER,
            error_details TEXT,
            import_time TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
