"""SQLite storage implementation for decorator analysis data."""

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator, Optional

from decorator_analyzer.models import (
    AnalysisResult,
    CallEvent,
    DecoratedFunction,
    DecoratorInfo,
    DecoratorType,
    FunctionMetadata,
    MetadataCheck,
    Risk,
    RiskLevel,
    RiskType,
    SignatureCheck,
)


@dataclass
class AnalysisSession:
    """Represents a single analysis session stored in the database."""
    id: str
    timestamp: datetime
    description: Optional[str] = None
    func_count: int = 0
    event_count: int = 0
    risk_count: int = 0


class JSONEncoder(json.JSONEncoder):
    """Custom JSON encoder for dataclasses and enums."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, (DecoratorType)):
            return obj.value
        if isinstance(obj, (RiskLevel, RiskType)):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if is_dataclass(obj):
            return asdict(obj)
        return super().default(obj)


def _json_dumps(obj: Any) -> str:
    """Serialize an object to JSON."""
    return json.dumps(obj, cls=JSONEncoder)


def _json_loads(s: str) -> Any:
    """Deserialize JSON string to object."""
    return json.loads(s)


class SQLiteStorage:
    """SQLite database storage for decorator analysis data."""

    SCHEMA_VERSION = 1

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        """Initialize the database schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
            if not cursor.fetchone():
                cursor.execute("INSERT INTO schema_version (version) VALUES (?)", (self.SCHEMA_VERSION,))
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS analysis_sessions (
                    id TEXT PRIMARY KEY,
                    timestamp TIMESTAMP NOT NULL,
                    description TEXT,
                    func_count INTEGER DEFAULT 0,
                    event_count INTEGER DEFAULT 0,
                    risk_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS decorated_functions (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    module TEXT NOT NULL,
                    signature TEXT NOT NULL,
                    docstring TEXT,
                    is_async BOOLEAN DEFAULT 0,
                    is_method BOOLEAN DEFAULT 0,
                    annotations TEXT,
                    decorator_order TEXT,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS decorators (
                    id TEXT PRIMARY KEY,
                    func_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    decorator_type TEXT NOT NULL,
                    module TEXT NOT NULL,
                    line_number INTEGER DEFAULT 0,
                    has_wraps BOOLEAN DEFAULT 0,
                    parameters TEXT,
                    source_code TEXT,
                    FOREIGN KEY (func_id) REFERENCES decorated_functions(id),
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS call_events (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    function_id TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    caller TEXT,
                    args TEXT,
                    kwargs TEXT,
                    return_value TEXT,
                    exception TEXT,
                    decorator_stack TEXT,
                    duration_ms REAL,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS risks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    function_id TEXT NOT NULL,
                    decorator_id TEXT,
                    risk_type TEXT NOT NULL,
                    level TEXT NOT NULL,
                    description TEXT NOT NULL,
                    location TEXT,
                    suggestion TEXT,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id),
                    FOREIGN KEY (function_id) REFERENCES decorated_functions(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS signature_checks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    function_id TEXT NOT NULL,
                    original_signature TEXT NOT NULL,
                    decorated_signature TEXT NOT NULL,
                    matches BOOLEAN DEFAULT 0,
                    differences TEXT,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id),
                    FOREIGN KEY (function_id) REFERENCES decorated_functions(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS metadata_checks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    function_id TEXT NOT NULL,
                    original_name TEXT NOT NULL,
                    decorated_name TEXT NOT NULL,
                    original_docstring TEXT,
                    decorated_docstring TEXT,
                    name_preserved BOOLEAN DEFAULT 0,
                    docstring_preserved BOOLEAN DEFAULT 0,
                    uses_wraps BOOLEAN DEFAULT 0,
                    FOREIGN KEY (session_id) REFERENCES analysis_sessions(id),
                    FOREIGN KEY (function_id) REFERENCES decorated_functions(id)
                )
            """)
            
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_func_session ON decorated_functions(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_event_session ON call_events(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_risk_session ON risks(session_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_risk_level ON risks(level)")
            
            conn.commit()

    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """Get a database connection with row factory enabled."""
        conn = sqlite3.connect(str(self.db_path), detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def save_analysis(self, result: AnalysisResult, description: Optional[str] = None) -> str:
        """Save an analysis result to the database.
        
        Returns the session ID.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO analysis_sessions (id, timestamp, description, func_count, event_count, risk_count)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                result.id,
                result.timestamp,
                description,
                len(result.decorated_functions),
                len(result.call_events),
                len(result.risks),
            ))
            
            for func in result.decorated_functions:
                self._save_decorated_function(cursor, result.id, func)
            
            for event in result.call_events:
                self._save_call_event(cursor, result.id, event)
            
            for risk in result.risks:
                self._save_risk(cursor, result.id, risk)
            
            for check in result.signature_checks:
                self._save_signature_check(cursor, result.id, check)
            
            for check in result.metadata_checks:
                self._save_metadata_check(cursor, result.id, check)
            
            conn.commit()
        
        return result.id

    def _save_decorated_function(
        self, cursor: sqlite3.Cursor, session_id: str, func: DecoratedFunction
    ) -> None:
        """Save a decorated function and its decorators."""
        cursor.execute("""
            INSERT INTO decorated_functions 
            (id, session_id, name, module, signature, docstring, is_async, is_method, annotations, decorator_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            func.id,
            session_id,
            func.function.name,
            func.function.module,
            func.function.signature,
            func.function.docstring,
            func.function.is_async,
            func.function.is_method,
            _json_dumps(func.function.annotations),
            _json_dumps(func.decorator_order),
        ))
        
        for dec in func.decorators:
            self._save_decorator(cursor, session_id, func.id, dec)

    def _save_decorator(
        self, cursor: sqlite3.Cursor, session_id: str, func_id: str, dec: DecoratorInfo
    ) -> None:
        """Save a decorator."""
        cursor.execute("""
            INSERT INTO decorators 
            (id, func_id, session_id, name, decorator_type, module, line_number, has_wraps, parameters, source_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            dec.id,
            func_id,
            session_id,
            dec.name,
            dec.decorator_type.value,
            dec.module,
            dec.line_number,
            dec.has_wraps,
            _json_dumps(dec.parameters),
            dec.source_code,
        ))

    def _save_call_event(
        self, cursor: sqlite3.Cursor, session_id: str, event: CallEvent
    ) -> None:
        """Save a call event."""
        cursor.execute("""
            INSERT INTO call_events 
            (id, session_id, function_id, timestamp, caller, args, kwargs, return_value, exception, decorator_stack, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            event.id,
            session_id,
            event.function_id,
            event.timestamp,
            event.caller,
            _json_dumps(event.args),
            _json_dumps(event.kwargs),
            _json_dumps(event.return_value) if event.return_value is not None else None,
            event.exception,
            _json_dumps(event.decorator_stack),
            event.duration_ms,
        ))

    def _save_risk(
        self, cursor: sqlite3.Cursor, session_id: str, risk: Risk
    ) -> None:
        """Save a risk."""
        cursor.execute("""
            INSERT INTO risks 
            (id, session_id, function_id, decorator_id, risk_type, level, description, location, suggestion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            risk.id,
            session_id,
            risk.function_id,
            risk.decorator_id,
            risk.risk_type.value,
            risk.level.value,
            risk.description,
            risk.location,
            risk.suggestion,
        ))

    def _save_signature_check(
        self, cursor: sqlite3.Cursor, session_id: str, check: SignatureCheck
    ) -> None:
        """Save a signature check."""
        cursor.execute("""
            INSERT INTO signature_checks 
            (id, session_id, function_id, original_signature, decorated_signature, matches, differences)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            check.function_id,
            session_id,
            check.function_id,
            check.original_signature,
            check.decorated_signature,
            check.matches,
            _json_dumps(check.differences),
        ))

    def _save_metadata_check(
        self, cursor: sqlite3.Cursor, session_id: str, check: MetadataCheck
    ) -> None:
        """Save a metadata check."""
        cursor.execute("""
            INSERT INTO metadata_checks 
            (id, session_id, function_id, original_name, decorated_name, original_docstring, decorated_docstring, name_preserved, docstring_preserved, uses_wraps)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            check.function_id,
            session_id,
            check.function_id,
            check.original_name,
            check.decorated_name,
            check.original_docstring,
            check.decorated_docstring,
            check.name_preserved,
            check.docstring_preserved,
            check.uses_wraps,
        ))

    def get_session(self, session_id: str) -> Optional[AnalysisSession]:
        """Get an analysis session by ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM analysis_sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            
            if row:
                return AnalysisSession(
                    id=row["id"],
                    timestamp=row["timestamp"],
                    description=row["description"],
                    func_count=row["func_count"],
                    event_count=row["event_count"],
                    risk_count=row["risk_count"],
                )
        return None

    def list_sessions(self, limit: int = 10) -> list[AnalysisSession]:
        """List recent analysis sessions."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM analysis_sessions 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (limit,))
            
            return [
                AnalysisSession(
                    id=row["id"],
                    timestamp=row["timestamp"],
                    description=row["description"],
                    func_count=row["func_count"],
                    event_count=row["event_count"],
                    risk_count=row["risk_count"],
                )
                for row in cursor.fetchall()
            ]

    def load_analysis(self, session_id: str) -> Optional[AnalysisResult]:
        """Load a complete analysis result from the database."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            session = self.get_session(session_id)
            if not session:
                return None
            
            decorated_functions = self._load_decorated_functions(cursor, session_id)
            call_events = self._load_call_events(cursor, session_id)
            risks = self._load_risks(cursor, session_id)
            signature_checks = self._load_signature_checks(cursor, session_id)
            metadata_checks = self._load_metadata_checks(cursor, session_id)
            
            return AnalysisResult(
                id=session_id,
                timestamp=session.timestamp,
                decorated_functions=decorated_functions,
                call_events=call_events,
                risks=risks,
                signature_checks=signature_checks,
                metadata_checks=metadata_checks,
            )

    def _load_decorated_functions(self, cursor: sqlite3.Cursor, session_id: str) -> list[DecoratedFunction]:
        """Load decorated functions for a session."""
        cursor.execute("SELECT * FROM decorated_functions WHERE session_id = ?", (session_id,))
        
        results: list[DecoratedFunction] = []
        for row in cursor.fetchall():
            decorators = self._load_decorators(cursor, row["id"])
            
            func = DecoratedFunction(
                id=row["id"],
                function=FunctionMetadata(
                    name=row["name"],
                    module=row["module"],
                    signature=row["signature"],
                    docstring=row["docstring"],
                    is_async=bool(row["is_async"]),
                    is_method=bool(row["is_method"]),
                    annotations=_json_loads(row["annotations"]) if row["annotations"] else {},
                ),
                decorators=decorators,
                decorator_order=_json_loads(row["decorator_order"]) if row["decorator_order"] else [],
            )
            results.append(func)
        
        return results

    def _load_decorators(self, cursor: sqlite3.Cursor, func_id: str) -> list[DecoratorInfo]:
        """Load decorators for a function."""
        cursor.execute("SELECT * FROM decorators WHERE func_id = ?", (func_id,))
        
        return [
            DecoratorInfo(
                id=row["id"],
                name=row["name"],
                decorator_type=DecoratorType(row["decorator_type"]),
                module=row["module"],
                line_number=row["line_number"],
                has_wraps=bool(row["has_wraps"]),
                parameters=_json_loads(row["parameters"]) if row["parameters"] else {},
                source_code=row["source_code"],
            )
            for row in cursor.fetchall()
        ]

    def _load_call_events(self, cursor: sqlite3.Cursor, session_id: str) -> list[CallEvent]:
        """Load call events for a session."""
        cursor.execute("SELECT * FROM call_events WHERE session_id = ? ORDER BY timestamp", (session_id,))
        
        return [
            CallEvent(
                id=row["id"],
                function_id=row["function_id"],
                timestamp=row["timestamp"],
                caller=row["caller"],
                args=tuple(_json_loads(row["args"])) if row["args"] else (),
                kwargs=_json_loads(row["kwargs"]) if row["kwargs"] else {},
                return_value=_json_loads(row["return_value"]) if row["return_value"] else None,
                exception=row["exception"],
                decorator_stack=_json_loads(row["decorator_stack"]) if row["decorator_stack"] else [],
                duration_ms=row["duration_ms"],
            )
            for row in cursor.fetchall()
        ]

    def _load_risks(self, cursor: sqlite3.Cursor, session_id: str) -> list[Risk]:
        """Load risks for a session."""
        cursor.execute("SELECT * FROM risks WHERE session_id = ?", (session_id,))
        
        return [
            Risk(
                id=row["id"],
                function_id=row["function_id"],
                decorator_id=row["decorator_id"],
                risk_type=RiskType(row["risk_type"]),
                level=RiskLevel(row["level"]),
                description=row["description"],
                location=row["location"],
                suggestion=row["suggestion"],
            )
            for row in cursor.fetchall()
        ]

    def _load_signature_checks(self, cursor: sqlite3.Cursor, session_id: str) -> list[SignatureCheck]:
        """Load signature checks for a session."""
        cursor.execute("SELECT * FROM signature_checks WHERE session_id = ?", (session_id,))
        
        return [
            SignatureCheck(
                function_id=row["function_id"],
                original_signature=row["original_signature"],
                decorated_signature=row["decorated_signature"],
                matches=bool(row["matches"]),
                differences=_json_loads(row["differences"]) if row["differences"] else [],
            )
            for row in cursor.fetchall()
        ]

    def _load_metadata_checks(self, cursor: sqlite3.Cursor, session_id: str) -> list[MetadataCheck]:
        """Load metadata checks for a session."""
        cursor.execute("SELECT * FROM metadata_checks WHERE session_id = ?", (session_id,))
        
        return [
            MetadataCheck(
                function_id=row["function_id"],
                original_name=row["original_name"],
                decorated_name=row["decorated_name"],
                original_docstring=row["original_docstring"],
                decorated_docstring=row["decorated_docstring"],
                name_preserved=bool(row["name_preserved"]),
                docstring_preserved=bool(row["docstring_preserved"]),
                uses_wraps=bool(row["uses_wraps"]),
            )
            for row in cursor.fetchall()
        ]
