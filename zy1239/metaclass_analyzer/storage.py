"""SQLite storage for metaclass analysis results."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .errors import DatabaseError
from .models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)


class SQLiteStorage:
    """SQLite database storage for analysis results."""

    SCHEMA_VERSION = 1

    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._init_database()

    @contextmanager
    def _get_connection(self):
        """Get a database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_database(self) -> None:
        """Initialize the database schema."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS analysis_runs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        total_classes INTEGER DEFAULT 0,
                        total_events INTEGER DEFAULT 0,
                        conflicts_found INTEGER DEFAULT 0,
                        errors_count INTEGER DEFAULT 0,
                        warnings_count INTEGER DEFAULT 0
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS classes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        name TEXT NOT NULL,
                        bases TEXT,
                        metaclass TEXT,
                        mro TEXT,
                        has_conflict INTEGER DEFAULT 0,
                        conflict_details TEXT,
                        source_file TEXT,
                        defined_at TIMESTAMP,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS fields (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        class_id INTEGER,
                        name TEXT NOT NULL,
                        value TEXT,
                        defined_in_class TEXT,
                        field_order INTEGER,
                        descriptor_type TEXT,
                        set_name_called INTEGER DEFAULT 0,
                        FOREIGN KEY (class_id) REFERENCES classes(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        event_type TEXT NOT NULL,
                        timestamp TIMESTAMP,
                        class_name TEXT,
                        metaclass_name TEXT,
                        details TEXT,
                        event_order INTEGER,
                        success INTEGER DEFAULT 1,
                        error_message TEXT,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS conflicts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        class_name TEXT NOT NULL,
                        bases TEXT,
                        base_metaclasses TEXT,
                        suggested_metaclass TEXT,
                        resolution_steps TEXT,
                        severity TEXT,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS suggestions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        suggestion TEXT NOT NULL,
                        category TEXT,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS warnings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        warning TEXT NOT NULL,
                        category TEXT,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS errors (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        run_id INTEGER,
                        error TEXT NOT NULL,
                        category TEXT,
                        FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
                    )
                """)

                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_classes_run_id ON classes(run_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_events_class_name ON events(class_name)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_conflicts_run_id ON conflicts(run_id)
                """)

                cursor.execute("SELECT version FROM schema_version")
                if not cursor.fetchone():
                    cursor.execute(
                        "INSERT INTO schema_version (version) VALUES (?)",
                        (self.SCHEMA_VERSION,)
                    )

                conn.commit()
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="initialize database",
                message="Failed to initialize database schema",
                original_error=e,
            )

    def save_analysis(self, result: AnalysisResult) -> int:
        """Save an analysis result to the database.

        Returns:
            The run ID of the saved analysis.
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("""
                    INSERT INTO analysis_runs 
                    (total_classes, total_events, conflicts_found, errors_count, warnings_count)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    len(result.classes),
                    len(result.timeline),
                    len(result.conflicts),
                    len(result.errors),
                    len(result.warnings),
                ))
                run_id = cursor.lastrowid

                for class_name, class_info in result.classes.items():
                    self._save_class(cursor, run_id, class_info)

                for event in result.timeline:
                    self._save_event(cursor, run_id, event)

                for conflict in result.conflicts:
                    self._save_conflict(cursor, run_id, conflict)

                for suggestion in result.suggestions:
                    cursor.execute("""
                        INSERT INTO suggestions (run_id, suggestion, category)
                        VALUES (?, ?, ?)
                    """, (run_id, suggestion, "general"))

                for warning in result.warnings:
                    cursor.execute("""
                        INSERT INTO warnings (run_id, warning, category)
                        VALUES (?, ?, ?)
                    """, (run_id, warning, "general"))

                for error in result.errors:
                    cursor.execute("""
                        INSERT INTO errors (run_id, error, category)
                        VALUES (?, ?, ?)
                    """, (run_id, error, "general"))

                conn.commit()
                return run_id
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="save analysis",
                message="Failed to save analysis to database",
                original_error=e,
            )

    def _save_class(self, cursor: sqlite3.Cursor, run_id: int, class_info: ClassInfo) -> None:
        """Save a single class to the database."""
        cursor.execute("""
            INSERT INTO classes 
            (run_id, name, bases, metaclass, mro, has_conflict, conflict_details, source_file, defined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            class_info.name,
            json.dumps(class_info.bases),
            class_info.metaclass,
            json.dumps(class_info.mro),
            1 if class_info.has_conflict else 0,
            class_info.conflict_details,
            class_info.source_file,
            class_info.defined_at.isoformat() if class_info.defined_at else None,
        ))
        class_id = cursor.lastrowid

        for field in class_info.fields:
            cursor.execute("""
                INSERT INTO fields 
                (class_id, name, value, defined_in_class, field_order, descriptor_type, set_name_called)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                class_id,
                field.name,
                str(field.value) if field.value is not None else None,
                field.defined_in_class,
                field.order,
                field.descriptor_type,
                1 if field.set_name_called else 0,
            ))

    def _save_event(self, cursor: sqlite3.Cursor, run_id: int, event: Event) -> None:
        """Save a single event to the database."""
        cursor.execute("""
            INSERT INTO events 
            (run_id, event_type, timestamp, class_name, metaclass_name, details, event_order, success, error_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            event.event_type.value,
            event.timestamp.isoformat(),
            event.class_name,
            event.metaclass_name,
            json.dumps(event.details) if event.details else None,
            event.order,
            1 if event.success else 0,
            event.error_message,
        ))

    def _save_conflict(self, cursor: sqlite3.Cursor, run_id: int, conflict: ConflictInfo) -> None:
        """Save a single conflict to the database."""
        cursor.execute("""
            INSERT INTO conflicts 
            (run_id, class_name, bases, base_metaclasses, suggested_metaclass, resolution_steps, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            conflict.class_name,
            json.dumps(conflict.bases),
            json.dumps(conflict.base_metaclasses),
            conflict.suggested_metaclass,
            json.dumps(conflict.resolution_steps),
            conflict.severity,
        ))

    def get_latest_run(self) -> Optional[Dict[str, Any]]:
        """Get the latest analysis run."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM analysis_runs ORDER BY id DESC LIMIT 1
                """)
                row = cursor.fetchone()
                return dict(row) if row else None
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="get latest run",
                message="Failed to get latest analysis run",
                original_error=e,
            )

    def get_run(self, run_id: int) -> Optional[AnalysisResult]:
        """Get a specific analysis run by ID."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()

                cursor.execute("SELECT * FROM analysis_runs WHERE id = ?", (run_id,))
                run_row = cursor.fetchone()
                if not run_row:
                    return None

                result = AnalysisResult()

                cursor.execute("SELECT * FROM classes WHERE run_id = ?", (run_id,))
                for row in cursor.fetchall():
                    class_info = self._row_to_class_info(row)
                    result.classes[class_info.name] = class_info

                cursor.execute("SELECT * FROM fields WHERE class_id IN (SELECT id FROM classes WHERE run_id = ?)", (run_id,))
                for row in cursor.fetchall():
                    field = self._row_to_field_info(row)
                    for class_name, class_info in result.classes.items():
                        if field.defined_in_class == class_name:
                            class_info.fields.append(field)
                            break

                cursor.execute("SELECT * FROM events WHERE run_id = ? ORDER BY timestamp, event_order", (run_id,))
                for row in cursor.fetchall():
                    event = self._row_to_event(row)
                    result.timeline.append(event)
                    if event.class_name in result.classes:
                        result.classes[event.class_name].events.append(event)

                cursor.execute("SELECT * FROM conflicts WHERE run_id = ?", (run_id,))
                for row in cursor.fetchall():
                    conflict = self._row_to_conflict_info(row)
                    result.conflicts.append(conflict)

                cursor.execute("SELECT suggestion FROM suggestions WHERE run_id = ?", (run_id,))
                for row in cursor.fetchall():
                    result.suggestions.append(row["suggestion"])

                cursor.execute("SELECT warning FROM warnings WHERE run_id = ?", (run_id,))
                for row in cursor.fetchall():
                    result.warnings.append(row["warning"])

                cursor.execute("SELECT error FROM errors WHERE run_id = ?", (run_id,))
                for row in cursor.fetchall():
                    result.errors.append(row["error"])

                return result
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="get run",
                message=f"Failed to get analysis run {run_id}",
                original_error=e,
            )

    def list_runs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """List recent analysis runs."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM analysis_runs ORDER BY id DESC LIMIT ?
                """, (limit,))
                return [dict(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="list runs",
                message="Failed to list analysis runs",
                original_error=e,
            )

    def get_class_timeline(self, class_name: str) -> List[Event]:
        """Get the event timeline for a specific class."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM events 
                    WHERE class_name = ? 
                    ORDER BY timestamp, event_order
                """, (class_name,))
                return [self._row_to_event(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="get class timeline",
                message=f"Failed to get timeline for class {class_name}",
                original_error=e,
            )

    def search_classes(self, pattern: str) -> List[Dict[str, Any]]:
        """Search for classes by name pattern."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT c.*, a.run_at 
                    FROM classes c 
                    JOIN analysis_runs a ON c.run_id = a.id
                    WHERE c.name LIKE ?
                    ORDER BY a.run_at DESC
                """, (f"%{pattern}%",))
                return [dict(row) for row in cursor.fetchall()]
        except sqlite3.Error as e:
            raise DatabaseError(
                operation="search classes",
                message=f"Failed to search classes for pattern {pattern}",
                original_error=e,
            )

    def _row_to_class_info(self, row: sqlite3.Row) -> ClassInfo:
        """Convert a database row to ClassInfo."""
        return ClassInfo(
            name=row["name"],
            bases=json.loads(row["bases"]) if row["bases"] else [],
            metaclass=row["metaclass"] or "type",
            mro=json.loads(row["mro"]) if row["mro"] else [],
            has_conflict=bool(row["has_conflict"]),
            conflict_details=row["conflict_details"],
            source_file=row["source_file"],
            defined_at=datetime.fromisoformat(row["defined_at"]) if row["defined_at"] else None,
        )

    def _row_to_field_info(self, row: sqlite3.Row) -> FieldInfo:
        """Convert a database row to FieldInfo."""
        return FieldInfo(
            name=row["name"],
            value=row["value"],
            defined_in_class=row["defined_in_class"],
            order=row["field_order"],
            descriptor_type=row["descriptor_type"],
            set_name_called=bool(row["set_name_called"]),
        )

    def _row_to_event(self, row: sqlite3.Row) -> Event:
        """Convert a database row to Event."""
        try:
            event_type = EventType(row["event_type"])
        except ValueError:
            event_type = EventType.CLASS_CREATED

        return Event(
            event_type=event_type,
            timestamp=datetime.fromisoformat(row["timestamp"]) if row["timestamp"] else datetime.now(),
            class_name=row["class_name"] or "",
            metaclass_name=row["metaclass_name"],
            details=json.loads(row["details"]) if row["details"] else {},
            order=row["event_order"] or 0,
            success=bool(row["success"]),
            error_message=row["error_message"],
        )

    def _row_to_conflict_info(self, row: sqlite3.Row) -> ConflictInfo:
        """Convert a database row to ConflictInfo."""
        return ConflictInfo(
            class_name=row["class_name"],
            bases=json.loads(row["bases"]) if row["bases"] else [],
            base_metaclasses=json.loads(row["base_metaclasses"]) if row["base_metaclasses"] else {},
            suggested_metaclass=row["suggested_metaclass"],
            resolution_steps=json.loads(row["resolution_steps"]) if row["resolution_steps"] else [],
            severity=row["severity"] or "error",
        )
