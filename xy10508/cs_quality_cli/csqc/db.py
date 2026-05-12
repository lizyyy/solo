import sqlite3
import os
from contextlib import contextmanager
from typing import List, Dict, Optional, Any, Generator


DB_FILENAME = "csqc.db"


def get_db_path(project_dir: str) -> str:
    return os.path.join(project_dir, DB_FILENAME)


@contextmanager
def get_connection(project_dir: str) -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(get_db_path(project_dir))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(project_dir: str) -> None:
    db_path = get_db_path(project_dir)
    if os.path.exists(db_path):
        raise FileExistsError(f"数据库已存在: {db_path}")

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                team TEXT,
                role TEXT DEFAULT '客服',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                customer_id TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT DEFAULT 'closed',
                messages_json TEXT NOT NULL,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_scan_id INTEGER
            )
        ''')

        cursor.execute('''
            CREATE TABLE rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                keywords_json TEXT NOT NULL,
                severity TEXT DEFAULT 'medium',
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE refund_policies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                policy_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                conditions_json TEXT NOT NULL,
                max_amount REAL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_sessions INTEGER,
                flagged_sessions INTEGER,
                status TEXT DEFAULT 'completed'
            )
        ''')

        cursor.execute('''
            CREATE TABLE hits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                rule_id TEXT NOT NULL,
                agent_id TEXT,
                hit_text TEXT NOT NULL,
                message_index INTEGER,
                message_sender TEXT,
                message_time TEXT,
                context_before TEXT,
                context_after TEXT,
                user_quote TEXT,
                transfer_to_agent TEXT,
                is_duplicate INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (scan_id) REFERENCES scans(id),
                FOREIGN KEY (session_id) REFERENCES sessions(session_id),
                FOREIGN KEY (rule_id) REFERENCES rules(rule_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hit_id INTEGER NOT NULL,
                reviewer TEXT NOT NULL,
                decision TEXT NOT NULL,
                original_hit_text TEXT,
                corrected_hit_text TEXT,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hit_id) REFERENCES hits(id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE import_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                file_path TEXT,
                count INTEGER,
                status TEXT,
                error_message TEXT,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('CREATE INDEX idx_hits_session ON hits(session_id)')
        cursor.execute('CREATE INDEX idx_hits_rule ON hits(rule_id)')
        cursor.execute('CREATE INDEX idx_hits_agent ON hits(agent_id)')
        cursor.execute('CREATE INDEX idx_reviews_hit ON reviews(hit_id)')
