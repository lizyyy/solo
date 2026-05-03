import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, TypeVar, Type, Generic, Iterator

from app.models import (
    Actor, Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel, CheckStatus
)


T = TypeVar('T')


def datetime_to_iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def iso_to_datetime(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def json_loads(s: Optional[str]) -> Any:
    if not s:
        return {}
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return {}


class Database:
    SCHEMA_VERSION = 1

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._ensure_db_exists()

    def _ensure_db_exists(self):
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        with self.get_connection() as conn:
            self._create_tables(conn)
            self._migrate_schema(conn)

    @contextmanager
    def get_connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _create_tables(self, conn: sqlite3.Connection):
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS actors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT,
                contact_info TEXT,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS props (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                danger_level TEXT NOT NULL DEFAULT 'SAFE',
                is_dangerous INTEGER NOT NULL DEFAULT 0,
                danger_description TEXT,
                requires_verification INTEGER NOT NULL DEFAULT 0,
                location TEXT,
                owner TEXT,
                total_quantity INTEGER NOT NULL DEFAULT 1,
                available_quantity INTEGER NOT NULL DEFAULT 1,
                barcode TEXT,
                serial_number TEXT,
                notes TEXT,
                last_verified_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                act_number INTEGER NOT NULL DEFAULT 1,
                scene_number INTEGER NOT NULL DEFAULT 1,
                title TEXT,
                description TEXT,
                location TEXT,
                start_time TEXT,
                end_time TEXT,
                duration_minutes INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS handover_records (
                id TEXT PRIMARY KEY,
                prop_id TEXT,
                prop_name TEXT,
                scene_id TEXT,
                scene_title TEXT,
                actor_id TEXT,
                actor_name TEXT,
                status TEXT NOT NULL DEFAULT 'PENDING',
                quantity INTEGER NOT NULL DEFAULT 1,
                scheduled_start_time TEXT,
                scheduled_end_time TEXT,
                actual_start_time TEXT,
                actual_end_time TEXT,
                handover_person TEXT,
                return_person TEXT,
                verification_person TEXT,
                notes TEXT,
                verification_notes TEXT,
                is_signed_out INTEGER NOT NULL DEFAULT 0,
                signed_out_at TEXT,
                is_signed_in INTEGER NOT NULL DEFAULT 0,
                signed_in_at TEXT,
                is_verified INTEGER NOT NULL DEFAULT 0,
                verified_at TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (prop_id) REFERENCES props (id),
                FOREIGN KEY (scene_id) REFERENCES scenes (id),
                FOREIGN KEY (actor_id) REFERENCES actors (id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS violations (
                id TEXT PRIMARY KEY,
                violation_type TEXT NOT NULL,
                check_status TEXT NOT NULL DEFAULT 'ERROR',
                severity TEXT NOT NULL DEFAULT 'high',
                description TEXT NOT NULL,
                prop_id TEXT,
                prop_name TEXT,
                scene_id TEXT,
                scene_title TEXT,
                handover_id TEXT,
                actor_id TEXT,
                actor_name TEXT,
                related_entities TEXT,
                detected_at TEXT NOT NULL,
                resolved INTEGER NOT NULL DEFAULT 0,
                resolved_at TEXT,
                resolved_by TEXT,
                resolution_notes TEXT,
                metadata TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_handover_prop ON handover_records (prop_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_handover_scene ON handover_records (scene_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_handover_actor ON handover_records (actor_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_handover_status ON handover_records (status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations (resolved)
        """)

    def _migrate_schema(self, conn: sqlite3.Connection):
        cursor = conn.cursor()
        cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
        row = cursor.fetchone()

        if not row:
            cursor.execute(
                "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                (self.SCHEMA_VERSION, datetime.now().isoformat())
            )
