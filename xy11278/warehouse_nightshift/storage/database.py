import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime, date
from pathlib import Path
from typing import Generator, List, Dict, Any, Optional, TypeVar, Generic, Type

from warehouse_nightshift.config import DB_PATH
from warehouse_nightshift.models import (
    Forklift, ChargingStation, Task, Schedule, ImportRecord, FailedRecord,
    OperationLog, TaskStatus, ExceptionType, ImportStatus
)

T = TypeVar('T')


def adapt_date(d: date) -> str:
    return d.isoformat()


def convert_date(s: bytes) -> date:
    return date.fromisoformat(s.decode())


def adapt_datetime(dt: datetime) -> str:
    return dt.isoformat()


def convert_datetime(s: bytes) -> datetime:
    return datetime.fromisoformat(s.decode())


def adapt_dict(d: Dict) -> str:
    return json.dumps(d, ensure_ascii=False)


def convert_dict(s: bytes) -> Dict:
    return json.loads(s.decode())


def adapt_list(l: List) -> str:
    return json.dumps(l, ensure_ascii=False)


def convert_list(s: bytes) -> List:
    return json.loads(s.decode())


sqlite3.register_adapter(date, adapt_date)
sqlite3.register_converter("DATE", convert_date)
sqlite3.register_adapter(datetime, adapt_datetime)
sqlite3.register_converter("DATETIME", convert_datetime)
sqlite3.register_adapter(dict, adapt_dict)
sqlite3.register_converter("DICT", convert_dict)
sqlite3.register_adapter(list, adapt_list)
sqlite3.register_converter("LIST", convert_list)


class Database:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(
            self.db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
        )
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS forklifts (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    battery_level INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    last_maintenance DATE NOT NULL,
                    current_operator TEXT,
                    current_station TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS charging_stations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    occupied_by TEXT,
                    occupied_since DATETIME,
                    expected_free_time DATETIME,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    assigned_forklift TEXT,
                    assigned_operator TEXT,
                    status TEXT NOT NULL,
                    scheduled_date DATE,
                    shift TEXT,
                    estimated_duration INTEGER NOT NULL,
                    actual_start DATETIME,
                    actual_end DATETIME,
                    exception_type TEXT,
                    exception_note TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS schedules (
                    id TEXT PRIMARY KEY,
                    schedule_date DATE NOT NULL,
                    shift TEXT NOT NULL,
                    forklift_assignments DICT NOT NULL,
                    task_order LIST NOT NULL,
                    notes TEXT,
                    reviewed_by TEXT,
                    reviewed_at DATETIME,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_records (
                    id TEXT PRIMARY KEY,
                    import_type TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    status TEXT NOT NULL,
                    total_records INTEGER NOT NULL,
                    success_count INTEGER NOT NULL,
                    failed_count INTEGER NOT NULL,
                    imported_by TEXT NOT NULL,
                    created_at DATETIME NOT NULL
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS failed_records (
                    id TEXT PRIMARY KEY,
                    import_id TEXT NOT NULL,
                    record_type TEXT NOT NULL,
                    original_data TEXT NOT NULL,
                    row_number INTEGER NOT NULL,
                    error_message TEXT NOT NULL,
                    suggestion TEXT NOT NULL,
                    resolved INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL,
                    FOREIGN KEY (import_id) REFERENCES import_records(id)
                )
            ''')

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS operation_logs (
                    id TEXT PRIMARY KEY,
                    action TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    details DICT NOT NULL,
                    operator TEXT NOT NULL,
                    created_at DATETIME NOT NULL
                )
            ''')

            conn.commit()


class BaseRepository(Generic[T]):
    def __init__(self, db: Database, table_name: str, model_class: Type[T]):
        self.db = db
        self.table_name = table_name
        self.model_class = model_class

    def _row_to_object(self, row: sqlite3.Row) -> T:
        data = dict(row)
        return self.model_class(**data)

    def get_by_id(self, entity_id: str) -> Optional[T]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT * FROM {self.table_name} WHERE id = ?', (entity_id,))
            row = cursor.fetchone()
            return self._row_to_object(row) if row else None

    def get_all(self) -> List[T]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT * FROM {self.table_name} ORDER BY created_at DESC')
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]

    def delete(self, entity_id: str) -> bool:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f'DELETE FROM {self.table_name} WHERE id = ?', (entity_id,))
            return cursor.rowcount > 0


class ForkliftRepository(BaseRepository[Forklift]):
    def __init__(self, db: Database):
        super().__init__(db, 'forklifts', Forklift)

    def save(self, forklift: Forklift) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO forklifts 
                (id, name, battery_level, status, last_maintenance, 
                 current_operator, current_station, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                forklift.id, forklift.name, forklift.battery_level, forklift.status,
                forklift.last_maintenance, forklift.current_operator,
                forklift.current_station, forklift.created_at, forklift.updated_at
            ))

    def get_available(self) -> List[Forklift]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM forklifts 
                WHERE status = 'available' AND battery_level >= 30
                ORDER BY battery_level DESC
            ''')
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]


class ChargingStationRepository(BaseRepository[ChargingStation]):
    def __init__(self, db: Database):
        super().__init__(db, 'charging_stations', ChargingStation)

    def save(self, station: ChargingStation) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO charging_stations 
                (id, name, status, occupied_by, occupied_since, 
                 expected_free_time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                station.id, station.name, station.status, station.occupied_by,
                station.occupied_since, station.expected_free_time,
                station.created_at, station.updated_at
            ))

    def get_available(self) -> List[ChargingStation]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM charging_stations WHERE status = 'available'
            ''')
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]


class TaskRepository(BaseRepository[Task]):
    def __init__(self, db: Database):
        super().__init__(db, 'tasks', Task)

    def _row_to_object(self, row: sqlite3.Row) -> Task:
        data = dict(row)
        if data.get('status'):
            data['status'] = TaskStatus(data['status'])
        if data.get('exception_type'):
            data['exception_type'] = ExceptionType(data['exception_type'])
        return Task(**data)

    def save(self, task: Task) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO tasks 
                (id, title, description, priority, assigned_forklift, assigned_operator,
                 status, scheduled_date, shift, estimated_duration, actual_start,
                 actual_end, exception_type, exception_note, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                task.id, task.title, task.description, task.priority,
                task.assigned_forklift, task.assigned_operator,
                task.status.value if task.status else None,
                task.scheduled_date, task.shift, task.estimated_duration,
                task.actual_start, task.actual_end,
                task.exception_type.value if task.exception_type else None,
                task.exception_note, task.created_at, task.updated_at
            ))

    def query(self, operator: Optional[str] = None, start_date: Optional[date] = None,
              end_date: Optional[date] = None, status: Optional[TaskStatus] = None,
              exception_type: Optional[ExceptionType] = None) -> List[Task]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM tasks WHERE 1=1'
            params = []

            if operator:
                query += ' AND assigned_operator = ?'
                params.append(operator)
            if start_date:
                query += ' AND scheduled_date >= ?'
                params.append(start_date)
            if end_date:
                query += ' AND scheduled_date <= ?'
                params.append(end_date)
            if status:
                query += ' AND status = ?'
                params.append(status.value)
            if exception_type:
                query += ' AND exception_type = ?'
                params.append(exception_type.value)

            query += ' ORDER BY scheduled_date DESC, priority DESC'
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]

    def get_by_date_and_shift(self, schedule_date: date, shift: str) -> List[Task]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM tasks 
                WHERE scheduled_date = ? AND shift = ?
                ORDER BY priority DESC
            ''', (schedule_date, shift))
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]


class ScheduleRepository(BaseRepository[Schedule]):
    def __init__(self, db: Database):
        super().__init__(db, 'schedules', Schedule)

    def save(self, schedule: Schedule) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO schedules 
                (id, schedule_date, shift, forklift_assignments, task_order,
                 notes, reviewed_by, reviewed_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                schedule.id, schedule.schedule_date, schedule.shift,
                schedule.forklift_assignments, schedule.task_order,
                schedule.notes, schedule.reviewed_by, schedule.reviewed_at,
                schedule.created_at, schedule.updated_at
            ))

    def get_by_date_and_shift(self, schedule_date: date, shift: str) -> Optional[Schedule]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM schedules WHERE schedule_date = ? AND shift = ?
            ''', (schedule_date, shift))
            row = cursor.fetchone()
            return self._row_to_object(row) if row else None


class ImportRecordRepository(BaseRepository[ImportRecord]):
    def __init__(self, db: Database):
        super().__init__(db, 'import_records', ImportRecord)

    def _row_to_object(self, row: sqlite3.Row) -> ImportRecord:
        data = dict(row)
        if data.get('status'):
            data['status'] = ImportStatus(data['status'])
        return ImportRecord(**data)

    def save(self, record: ImportRecord) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO import_records 
                (id, import_type, file_name, status, total_records, 
                 success_count, failed_count, imported_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.id, record.import_type, record.file_name,
                record.status.value, record.total_records,
                record.success_count, record.failed_count,
                record.imported_by, record.created_at
            ))


class FailedRecordRepository(BaseRepository[FailedRecord]):
    def __init__(self, db: Database):
        super().__init__(db, 'failed_records', FailedRecord)

    def save(self, record: FailedRecord) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO failed_records 
                (id, import_id, record_type, original_data, row_number,
                 error_message, suggestion, resolved, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.id, record.import_id, record.record_type,
                record.original_data, record.row_number,
                record.error_message, record.suggestion,
                1 if record.resolved else 0, record.created_at
            ))

    def get_by_import_id(self, import_id: str) -> List[FailedRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM failed_records WHERE import_id = ?
            ''', (import_id,))
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]

    def get_unresolved(self) -> List[FailedRecord]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM failed_records WHERE resolved = 0
            ''')
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]


class OperationLogRepository(BaseRepository[OperationLog]):
    def __init__(self, db: Database):
        super().__init__(db, 'operation_logs', OperationLog)

    def save(self, log: OperationLog) -> None:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO operation_logs 
                (id, action, entity_type, entity_id, details, operator, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                log.id, log.action, log.entity_type, log.entity_id,
                log.details, log.operator, log.created_at
            ))

    def get_by_entity(self, entity_type: str, entity_id: str) -> List[OperationLog]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM operation_logs 
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY created_at DESC
            ''', (entity_type, entity_id))
            rows = cursor.fetchall()
            return [self._row_to_object(row) for row in rows]


class UnitOfWork:
    def __init__(self, db: Database):
        self.db = db
        self.forklifts = ForkliftRepository(db)
        self.charging_stations = ChargingStationRepository(db)
        self.tasks = TaskRepository(db)
        self.schedules = ScheduleRepository(db)
        self.import_records = ImportRecordRepository(db)
        self.failed_records = FailedRecordRepository(db)
        self.operation_logs = OperationLogRepository(db)
