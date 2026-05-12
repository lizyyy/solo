import sqlite3
import hashlib
import json
from pathlib import Path
from datetime import datetime, date
from typing import Optional, List, Dict, Any, Tuple
from contextlib import contextmanager

from .models import (
    Participant, Role, ParticipantRole, Meeting, ActionItem,
    ActionItemStatus, AuditLog, OperationType, ImportRecord
)


DB_PATH = Path(".") / ".meeting-ai" / "actions.db"


def get_db_path() -> Path:
    return DB_PATH


def init_db(db_path: Optional[Path] = None) -> bool:
    path = db_path or get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    
    if path.exists():
        return False
    
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    
    conn.execute('''
        CREATE TABLE participants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            email TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    conn.execute('''
        CREATE TABLE roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    conn.execute('''
        CREATE TABLE participant_roles (
            participant_id INTEGER NOT NULL,
            role_id INTEGER NOT NULL,
            PRIMARY KEY (participant_id, role_id),
            FOREIGN KEY (participant_id) REFERENCES participants(id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        )
    ''')
    
    conn.execute('''
        CREATE TABLE meetings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            meeting_date TEXT NOT NULL,
            attendees TEXT NOT NULL,
            content_hash TEXT NOT NULL UNIQUE,
            source_path TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    conn.execute('''
        CREATE TABLE action_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meeting_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            assignees TEXT NOT NULL,
            due_date TEXT,
            status TEXT NOT NULL,
            dependencies TEXT NOT NULL DEFAULT '[]',
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id)
        )
    ''')
    
    conn.execute('''
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            operation_type TEXT NOT NULL,
            operator TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            reason TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    conn.execute('''
        CREATE TABLE import_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_hash TEXT NOT NULL UNIQUE,
            source_path TEXT NOT NULL,
            imported_at TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    return True


def compute_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def serialize_list(items: List) -> str:
    return json.dumps(items, ensure_ascii=False)


def deserialize_list(data: str) -> List:
    if not data:
        return []
    return json.loads(data)


def parse_date(date_str: Optional[str]) -> Optional[date]:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str).date()
    except:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except:
            return None


def format_date(d: Optional[date]) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except:
        return None


def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat()


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_db_path())
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_audit(entity_type: str, entity_id: int, operation: OperationType, 
              operator: str, old_value: Optional[Any] = None, 
              new_value: Optional[Any] = None, reason: Optional[str] = None):
    with get_connection() as conn:
        old_str = json.dumps(old_value, ensure_ascii=False, default=str) if old_value is not None else None
        new_str = json.dumps(new_value, ensure_ascii=False, default=str) if new_value is not None else None
        
        conn.execute('''
            INSERT INTO audit_logs (entity_type, entity_id, operation_type, 
                                   operator, old_value, new_value, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            entity_type, entity_id, operation.value,
            operator, old_str, new_str, reason,
            datetime.now().isoformat()
        ))
        conn.commit()
