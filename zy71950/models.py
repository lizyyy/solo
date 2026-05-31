import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum


class ReturnPointSource(Enum):
    KML = "航线KML"
    BATTERY = "电池记录"


class IssueStatus(Enum):
    PENDING = "待处理"
    RESOLVED = "已解决"


class OperationType(Enum):
    CREATE = "创建"
    UPDATE = "更新"
    DELETE = "删除"


@dataclass
class FlightSchedule:
    id: Optional[int]
    batch_id: str
    flight_date: str
    area: str
    pilot: str
    drone_id: str
    kml_file: str
    kml_md5: str
    weather_snapshot: str
    status: str
    created_at: str
    updated_at: str
    return_point: Optional[str] = None
    return_point_source: Optional[str] = None


@dataclass
class KMLHistory:
    id: Optional[int]
    schedule_id: int
    batch_id: str
    old_kml_file: str
    new_kml_file: str
    old_kml_md5: str
    new_kml_md5: str
    modified_by: str
    modified_at: str
    change_reason: str


@dataclass
class ReturnPointIssue:
    id: Optional[int]
    schedule_id: int
    batch_id: str
    missing_source: str
    detected_at: str
    status: str
    assignee: str
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None


@dataclass
class WeatherHistory:
    id: Optional[int]
    schedule_id: int
    batch_id: str
    old_snapshot: str
    new_snapshot: str
    modified_by: str
    modified_at: str
    operation_type: str


class Database:
    def __init__(self, db_path: str = "flight_schedule.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flight_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT UNIQUE NOT NULL,
                flight_date TEXT NOT NULL,
                area TEXT NOT NULL,
                pilot TEXT NOT NULL,
                drone_id TEXT NOT NULL,
                kml_file TEXT NOT NULL,
                kml_md5 TEXT NOT NULL,
                weather_snapshot TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                return_point TEXT,
                return_point_source TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS kml_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER NOT NULL,
                batch_id TEXT NOT NULL,
                old_kml_file TEXT NOT NULL,
                new_kml_file TEXT NOT NULL,
                old_kml_md5 TEXT NOT NULL,
                new_kml_md5 TEXT NOT NULL,
                modified_by TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                change_reason TEXT NOT NULL,
                FOREIGN KEY (schedule_id) REFERENCES flight_schedules (id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS return_point_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER NOT NULL,
                batch_id TEXT NOT NULL,
                missing_source TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                assignee TEXT NOT NULL,
                resolved_at TEXT,
                resolution_note TEXT,
                FOREIGN KEY (schedule_id) REFERENCES flight_schedules (id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS weather_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schedule_id INTEGER NOT NULL,
                batch_id TEXT NOT NULL,
                old_snapshot TEXT,
                new_snapshot TEXT NOT NULL,
                modified_by TEXT NOT NULL,
                modified_at TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                FOREIGN KEY (schedule_id) REFERENCES flight_schedules (id)
            )
        ''')

        conn.commit()
        conn.close()

    def find_schedule_by_batch(self, batch_id: str) -> Optional[FlightSchedule]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM flight_schedules WHERE batch_id = ?",
            (batch_id,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return FlightSchedule(**dict(row))
        return None

    def create_schedule(self, schedule: FlightSchedule) -> FlightSchedule:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO flight_schedules 
            (batch_id, flight_date, area, pilot, drone_id, kml_file, kml_md5, 
             weather_snapshot, status, return_point, return_point_source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            schedule.batch_id, schedule.flight_date, schedule.area, schedule.pilot,
            schedule.drone_id, schedule.kml_file, schedule.kml_md5,
            schedule.weather_snapshot, schedule.status,
            schedule.return_point, schedule.return_point_source,
            now, now
        ))
        schedule.id = cursor.lastrowid
        schedule.created_at = now
        schedule.updated_at = now
        conn.commit()
        conn.close()
        return schedule

    def update_schedule(self, schedule: FlightSchedule) -> FlightSchedule:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()
        cursor.execute('''
            UPDATE flight_schedules SET
                flight_date = ?, area = ?, pilot = ?, drone_id = ?,
                kml_file = ?, kml_md5 = ?, weather_snapshot = ?, status = ?,
                return_point = ?, return_point_source = ?, updated_at = ?
            WHERE id = ?
        ''', (
            schedule.flight_date, schedule.area, schedule.pilot, schedule.drone_id,
            schedule.kml_file, schedule.kml_md5, schedule.weather_snapshot,
            schedule.status, schedule.return_point, schedule.return_point_source,
            now, schedule.id
        ))
        schedule.updated_at = now
        conn.commit()
        conn.close()
        return schedule

    def add_kml_history(self, history: KMLHistory) -> KMLHistory:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO kml_history 
            (schedule_id, batch_id, old_kml_file, new_kml_file, old_kml_md5, 
             new_kml_md5, modified_by, modified_at, change_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            history.schedule_id, history.batch_id, history.old_kml_file,
            history.new_kml_file, history.old_kml_md5, history.new_kml_md5,
            history.modified_by, history.modified_at, history.change_reason
        ))
        history.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return history

    def add_return_point_issue(self, issue: ReturnPointIssue) -> ReturnPointIssue:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO return_point_issues 
            (schedule_id, batch_id, missing_source, detected_at, status, assignee)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            issue.schedule_id, issue.batch_id, issue.missing_source,
            issue.detected_at, issue.status, issue.assignee
        ))
        issue.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return issue

    def add_weather_history(self, history: WeatherHistory) -> WeatherHistory:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO weather_history 
            (schedule_id, batch_id, old_snapshot, new_snapshot, 
             modified_by, modified_at, operation_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            history.schedule_id, history.batch_id, history.old_snapshot,
            history.new_snapshot, history.modified_by,
            history.modified_at, history.operation_type
        ))
        history.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return history

    def get_kml_history_by_batch(self, batch_id: str) -> List[KMLHistory]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM kml_history WHERE batch_id = ? ORDER BY modified_at DESC",
            (batch_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [KMLHistory(**dict(row)) for row in rows]

    def get_weather_history_by_batch(self, batch_id: str) -> List[WeatherHistory]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM weather_history WHERE batch_id = ? ORDER BY modified_at DESC",
            (batch_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [WeatherHistory(**dict(row)) for row in rows]

    def get_return_point_issues_by_batch(self, batch_id: str) -> List[ReturnPointIssue]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM return_point_issues WHERE batch_id = ? ORDER BY detected_at DESC",
            (batch_id,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [ReturnPointIssue(**dict(row)) for row in rows]
