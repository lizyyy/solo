"""SQLite storage layer for descriptor inspection data."""

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    AnalysisResult,
    ComparisonResult,
    DescriptorCase,
    DescriptorType,
    Event,
    EventType,
    ValidationError,
)


class StorageManager:
    """Manager for SQLite storage operations."""

    SCHEMA_VERSION = 1

    def __init__(self, db_path: str = "descriptor_inspector.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        """Get a database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        """Initialize database schema."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                SELECT version FROM schema_version ORDER BY version DESC LIMIT 1
                """
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO schema_version (version, applied_at)
                    VALUES (?, ?)
                    """,
                    (self.SCHEMA_VERSION, datetime.now().isoformat()),
                )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS descriptor_cases (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    descriptor_type TEXT NOT NULL,
                    code_snippet TEXT,
                    expected_behavior TEXT,
                    tags TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    descriptor_name TEXT NOT NULL,
                    instance_type TEXT,
                    owner_class TEXT,
                    value TEXT,
                    exception TEXT,
                    call_stack TEXT,
                    context TEXT,
                    case_id TEXT,
                    FOREIGN KEY (case_id) REFERENCES descriptor_cases (id)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS analysis_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case_id TEXT NOT NULL,
                    descriptor_type TEXT NOT NULL,
                    priority_observed TEXT NOT NULL,
                    instance_dict_coverage INTEGER NOT NULL,
                    get_called INTEGER NOT NULL,
                    set_called INTEGER NOT NULL,
                    delete_called INTEGER NOT NULL,
                    set_name_called INTEGER NOT NULL,
                    validation_errors TEXT,
                    property_vs_cached_diff TEXT,
                    metadata TEXT,
                    analyzed_at TEXT NOT NULL,
                    FOREIGN KEY (case_id) REFERENCES descriptor_cases (id)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS comparison_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    case1_id TEXT NOT NULL,
                    case2_id TEXT NOT NULL,
                    differences TEXT,
                    similarities TEXT,
                    key_insights TEXT,
                    compared_at TEXT NOT NULL,
                    FOREIGN KEY (case1_id) REFERENCES descriptor_cases (id),
                    FOREIGN KEY (case2_id) REFERENCES descriptor_cases (id)
                )
                """
            )

            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_events_case_id ON events (case_id)
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_analysis_case_id ON analysis_results (case_id)
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_comparison_cases ON comparison_results (case1_id, case2_id)
                """
            )

            conn.commit()

    def save_descriptor_case(self, case: DescriptorCase) -> None:
        """Save a descriptor case to the database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO descriptor_cases 
                (id, name, description, descriptor_type, code_snippet, 
                 expected_behavior, tags, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    case.id,
                    case.name,
                    case.description,
                    case.descriptor_type.value,
                    case.code_snippet,
                    json.dumps(case.expected_behavior),
                    json.dumps(case.tags),
                    case.created_at.isoformat(),
                ),
            )
            conn.commit()

    def save_descriptor_cases(self, cases: List[DescriptorCase]) -> None:
        """Save multiple descriptor cases."""
        for case in cases:
            self.save_descriptor_case(case)

    def get_descriptor_case(self, case_id: str) -> Optional[DescriptorCase]:
        """Get a descriptor case by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM descriptor_cases WHERE id = ?
                """,
                (case_id,),
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_descriptor_case(row)
            return None

    def get_all_descriptor_cases(self) -> List[DescriptorCase]:
        """Get all descriptor cases."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM descriptor_cases ORDER BY created_at")
            return [self._row_to_descriptor_case(row) for row in cursor.fetchall()]

    def save_event(self, event: Event, case_id: Optional[str] = None) -> None:
        """Save an event to the database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO events 
                (timestamp, event_type, descriptor_name, instance_type, 
                 owner_class, value, exception, call_stack, context, case_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.timestamp.isoformat(),
                    event.event_type.value,
                    event.descriptor_name,
                    event.instance_type,
                    event.owner_class,
                    json.dumps(event.value) if event.value else None,
                    event.exception,
                    json.dumps(event.call_stack) if event.call_stack else None,
                    json.dumps(event.context),
                    case_id,
                ),
            )
            conn.commit()

    def save_events(self, events: List[Event], case_id: Optional[str] = None) -> None:
        """Save multiple events."""
        for event in events:
            self.save_event(event, case_id)

    def get_events_by_case(self, case_id: str) -> List[Event]:
        """Get all events for a specific case."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM events WHERE case_id = ? ORDER BY timestamp
                """,
                (case_id,),
            )
            return [self._row_to_event(row) for row in cursor.fetchall()]

    def save_analysis_result(self, result: AnalysisResult) -> int:
        """Save an analysis result and return its ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO analysis_results 
                (case_id, descriptor_type, priority_observed, instance_dict_coverage,
                 get_called, set_called, delete_called, set_name_called,
                 validation_errors, property_vs_cached_diff, metadata, analyzed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.case_id,
                    result.descriptor_type.value,
                    result.priority_observed,
                    1 if result.instance_dict_coverage else 0,
                    1 if result.get_called else 0,
                    1 if result.set_called else 0,
                    1 if result.delete_called else 0,
                    1 if result.set_name_called else 0,
                    json.dumps(result.validation_errors),
                    result.property_vs_cached_diff,
                    json.dumps(result.metadata),
                    result.analyzed_at.isoformat(),
                ),
            )
            result_id = cursor.lastrowid
            
            for event in result.events:
                self.save_event(event, result.case_id)
            
            conn.commit()
            return result_id

    def get_analysis_result(self, result_id: int) -> Optional[AnalysisResult]:
        """Get an analysis result by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM analysis_results WHERE id = ?
                """,
                (result_id,),
            )
            row = cursor.fetchone()
            if row:
                events = self.get_events_by_case(row["case_id"])
                return self._row_to_analysis_result(row, events)
            return None

    def get_analysis_results_by_case(self, case_id: str) -> List[AnalysisResult]:
        """Get all analysis results for a case."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM analysis_results WHERE case_id = ? ORDER BY analyzed_at
                """,
                (case_id,),
            )
            events = self.get_events_by_case(case_id)
            return [self._row_to_analysis_result(row, events) for row in cursor.fetchall()]

    def get_latest_analysis_for_case(self, case_id: str) -> Optional[AnalysisResult]:
        """Get the latest analysis result for a case."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM analysis_results 
                WHERE case_id = ? 
                ORDER BY analyzed_at DESC 
                LIMIT 1
                """,
                (case_id,),
            )
            row = cursor.fetchone()
            if row:
                events = self.get_events_by_case(case_id)
                return self._row_to_analysis_result(row, events)
            return None

    def save_comparison_result(self, result: ComparisonResult) -> int:
        """Save a comparison result and return its ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO comparison_results 
                (case1_id, case2_id, differences, similarities, key_insights, compared_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    result.case1_id,
                    result.case2_id,
                    json.dumps(result.differences),
                    json.dumps(result.similarities),
                    json.dumps(result.key_insights),
                    result.compared_at.isoformat(),
                ),
            )
            conn.commit()
            return cursor.lastrowid

    def get_comparison_result(self, result_id: int) -> Optional[ComparisonResult]:
        """Get a comparison result by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM comparison_results WHERE id = ?
                """,
                (result_id,),
            )
            row = cursor.fetchone()
            if row:
                return self._row_to_comparison_result(row)
            return None

    def get_comparisons_between(self, case1_id: str, case2_id: str) -> List[ComparisonResult]:
        """Get all comparisons between two cases."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM comparison_results 
                WHERE (case1_id = ? AND case2_id = ?) OR (case1_id = ? AND case2_id = ?)
                ORDER BY compared_at
                """,
                (case1_id, case2_id, case2_id, case1_id),
            )
            return [self._row_to_comparison_result(row) for row in cursor.fetchall()]

    def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM descriptor_cases")
            case_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM events")
            event_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM analysis_results")
            analysis_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM comparison_results")
            comparison_count = cursor.fetchone()[0]
            
            cursor.execute(
                """
                SELECT descriptor_type, COUNT(*) as cnt 
                FROM descriptor_cases 
                GROUP BY descriptor_type
                """
            )
            type_distribution = {row[0]: row[1] for row in cursor.fetchall()}
            
            return {
                "case_count": case_count,
                "event_count": event_count,
                "analysis_count": analysis_count,
                "comparison_count": comparison_count,
                "type_distribution": type_distribution,
            }

    def _row_to_descriptor_case(self, row: sqlite3.Row) -> DescriptorCase:
        """Convert a database row to a DescriptorCase."""
        return DescriptorCase(
            id=row["id"],
            name=row["name"],
            description=row["description"] or "",
            descriptor_type=DescriptorType(row["descriptor_type"]),
            code_snippet=row["code_snippet"] or "",
            expected_behavior=json.loads(row["expected_behavior"]) if row["expected_behavior"] else {},
            tags=json.loads(row["tags"]) if row["tags"] else [],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def _row_to_event(self, row: sqlite3.Row) -> Event:
        """Convert a database row to an Event."""
        return Event(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            event_type=EventType(row["event_type"]),
            descriptor_name=row["descriptor_name"],
            instance_type=row["instance_type"] or "unknown",
            owner_class=row["owner_class"] or "unknown",
            value=json.loads(row["value"]) if row["value"] else None,
            exception=row["exception"],
            call_stack=json.loads(row["call_stack"]) if row["call_stack"] else None,
            context=json.loads(row["context"]) if row["context"] else {},
        )

    def _row_to_analysis_result(self, row: sqlite3.Row, events: List[Event]) -> AnalysisResult:
        """Convert a database row to an AnalysisResult."""
        return AnalysisResult(
            case_id=row["case_id"],
            descriptor_type=DescriptorType(row["descriptor_type"]),
            events=events,
            priority_observed=row["priority_observed"],
            instance_dict_coverage=bool(row["instance_dict_coverage"]),
            get_called=bool(row["get_called"]),
            set_called=bool(row["set_called"]),
            delete_called=bool(row["delete_called"]),
            set_name_called=bool(row["set_name_called"]),
            validation_errors=json.loads(row["validation_errors"]) if row["validation_errors"] else [],
            property_vs_cached_diff=row["property_vs_cached_diff"],
            metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            analyzed_at=datetime.fromisoformat(row["analyzed_at"]),
        )

    def _row_to_comparison_result(self, row: sqlite3.Row) -> ComparisonResult:
        """Convert a database row to a ComparisonResult."""
        return ComparisonResult(
            case1_id=row["case1_id"],
            case2_id=row["case2_id"],
            differences=json.loads(row["differences"]) if row["differences"] else [],
            similarities=json.loads(row["similarities"]) if row["similarities"] else [],
            key_insights=json.loads(row["key_insights"]) if row["key_insights"] else [],
            compared_at=datetime.fromisoformat(row["compared_at"]),
        )
