import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional


DB_PATH = Path.home() / ".night_shift_ledger" / "ledger.db"


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS import_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_type TEXT NOT NULL,
                    source_file TEXT NOT NULL,
                    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    total_records INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    error_count INTEGER DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS vehicles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    plate_number TEXT NOT NULL,
                    battery_level REAL NOT NULL,
                    driver_name TEXT,
                    checkin_time TIMESTAMP,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES import_sessions(id)
                );

                CREATE TABLE IF NOT EXISTS charging_stations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    station_id TEXT NOT NULL,
                    is_occupied BOOLEAN DEFAULT 0,
                    vehicle_plate TEXT,
                    power_kw REAL,
                    last_updated TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES import_sessions(id)
                );

                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    task_id TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    priority TEXT DEFAULT 'normal',
                    description TEXT,
                    assignee TEXT,
                    status TEXT DEFAULT 'pending',
                    scheduled_time TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES import_sessions(id)
                );

                CREATE TABLE IF NOT EXISTS error_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER,
                    source_type TEXT NOT NULL,
                    row_number INTEGER,
                    raw_data TEXT NOT NULL,
                    error_message TEXT NOT NULL,
                    suggestion TEXT,
                    is_resolved BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES import_sessions(id)
                );

                CREATE INDEX IF NOT EXISTS idx_errors_session ON error_records(session_id);
                CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            """)

    def create_session(self, source_type: str, source_file: str) -> int:
        with self._get_conn() as conn:
            cursor = conn.execute(
                "INSERT INTO import_sessions (source_type, source_file) VALUES (?, ?)",
                (source_type, source_file)
            )
            return cursor.lastrowid

    def update_session_stats(self, session_id: int, total: int, success: int, errors: int):
        with self._get_conn() as conn:
            conn.execute(
                """UPDATE import_sessions 
                   SET total_records = ?, success_count = ?, error_count = ? 
                   WHERE id = ?""",
                (total, success, errors, session_id)
            )

    def insert_vehicle(self, session_id: int, data: Dict[str, Any]):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO vehicles 
                   (session_id, plate_number, battery_level, driver_name, checkin_time)
                   VALUES (?, ?, ?, ?, ?)""",
                (session_id, data["plate_number"], data["battery_level"],
                 data.get("driver_name"), data.get("checkin_time"))
            )

    def insert_charging_station(self, session_id: int, data: Dict[str, Any]):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO charging_stations 
                   (session_id, station_id, is_occupied, vehicle_plate, power_kw, last_updated)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (session_id, data["station_id"], data.get("is_occupied", False),
                 data.get("vehicle_plate"), data.get("power_kw"), data.get("last_updated"))
            )

    def insert_task(self, session_id: int, data: Dict[str, Any]):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO tasks 
                   (session_id, task_id, task_type, priority, description, assignee, scheduled_time)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (session_id, data["task_id"], data["task_type"],
                 data.get("priority", "normal"), data.get("description"),
                 data.get("assignee"), data.get("scheduled_time"))
            )

    def insert_error(self, session_id: int, source_type: str, row_number: int,
                     raw_data: str, error_message: str, suggestion: Optional[str] = None):
        with self._get_conn() as conn:
            conn.execute(
                """INSERT INTO error_records 
                   (session_id, source_type, row_number, raw_data, error_message, suggestion)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (session_id, source_type, row_number, raw_data, error_message, suggestion)
            )

    def get_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM import_sessions ORDER BY imported_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_vehicles(self, session_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM vehicles"
            params = []
            if session_id:
                query += " WHERE session_id = ?"
                params.append(session_id)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_charging_stations(self, session_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM charging_stations"
            params = []
            if session_id:
                query += " WHERE session_id = ?"
                params.append(session_id)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_tasks(self, session_id: Optional[int] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM tasks"
            params = []
            if session_id:
                query += " WHERE session_id = ?"
                params.append(session_id)
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def get_errors(self, session_id: Optional[int] = None, include_resolved: bool = False) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            query = "SELECT * FROM error_records WHERE 1=1"
            params = []
            if session_id:
                query += " AND session_id = ?"
                params.append(session_id)
            if not include_resolved:
                query += " AND is_resolved = 0"
            query += " ORDER BY created_at DESC"
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    def resolve_error(self, error_id: int):
        with self._get_conn() as conn:
            conn.execute("UPDATE error_records SET is_resolved = 1 WHERE id = ?", (error_id,))

    def get_dashboard_stats(self) -> Dict[str, Any]:
        with self._get_conn() as conn:
            total_sessions = conn.execute("SELECT COUNT(*) FROM import_sessions").fetchone()[0]
            total_vehicles = conn.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
            total_stations = conn.execute("SELECT COUNT(*) FROM charging_stations").fetchone()[0]
            total_tasks = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            pending_errors = conn.execute("SELECT COUNT(*) FROM error_records WHERE is_resolved = 0").fetchone()[0]
            
            return {
                "total_sessions": total_sessions,
                "total_vehicles": total_vehicles,
                "total_stations": total_stations,
                "total_tasks": total_tasks,
                "pending_errors": pending_errors
            }


db = Database()
