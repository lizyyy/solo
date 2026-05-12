import sqlite3
import json
import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class AppointmentStatus(Enum):
    PENDING = 'pending'
    ARRIVED = 'arrived'
    CALLED = 'called'
    OVERCALLED = 'overcalled'
    COMPLETED = 'completed'
    NO_SHOW = 'no_show'


class DoctorStatus(Enum):
    ON_DUTY = 'on_duty'
    TEMP_SUSPENDED = 'temp_suspended'
    PERM_SUSPENDED = 'perm_suspended'


class Database:
    def __init__(self, db_path: str = 'clinic.db'):
        self.db_path = db_path
        self.conn = None
        self.initialized = False

    def connect(self):
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            self.conn.execute("PRAGMA foreign_keys = ON")

    def close(self):
        if self.conn and not self.conn.closed:
            self.conn.close()
            self.conn = None

    def _get_conn(self):
        self.connect()
        return self.conn

    def init_db(self):
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS departments (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            window_number TEXT,
            type TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            department_id TEXT NOT NULL,
            title TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (department_id) REFERENCES departments(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctor_status_log (
            id TEXT PRIMARY KEY,
            doctor_id TEXT NOT NULL,
            status TEXT NOT NULL,
            change_time TEXT NOT NULL,
            reason TEXT,
            operator TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id TEXT PRIMARY KEY,
            patient_name TEXT NOT NULL,
            patient_id TEXT,
            department_id TEXT NOT NULL,
            doctor_id TEXT,
            appointment_date TEXT NOT NULL,
            appointment_time TEXT,
            queue_number TEXT NOT NULL,
            source_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (department_id) REFERENCES departments(id),
            FOREIGN KEY (doctor_id) REFERENCES doctors(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS arrival_records (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            arrival_time TEXT NOT NULL,
            queue_position INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS call_logs (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            call_time TEXT NOT NULL,
            queue_number TEXT NOT NULL,
            window_number TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS overcall_records (
            id TEXT PRIMARY KEY,
            appointment_id TEXT NOT NULL,
            overcall_time TEXT NOT NULL,
            reason TEXT,
            new_queue_number TEXT,
            requeue_count INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            operation_type TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            before_data TEXT,
            after_data TEXT,
            operator TEXT,
            created_at TEXT NOT NULL,
            reason TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_batches (
            id TEXT PRIMARY KEY,
            data_type TEXT NOT NULL,
            file_path TEXT,
            record_count INTEGER DEFAULT 0,
            success_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            status TEXT NOT NULL,
            error_message TEXT,
            created_at TEXT NOT NULL,
            operator TEXT
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS check_results (
            id TEXT PRIMARY KEY,
            check_type TEXT NOT NULL,
            check_time TEXT NOT NULL,
            department_id TEXT,
            result_summary TEXT,
            details TEXT,
            created_at TEXT NOT NULL
        )
        ''')

        conn.commit()
        self.initialized = True

    def log_operation(self, operation_type: str, entity_type: str, entity_id: str,
                        before_data: Dict, after_data: Dict, operator: str, reason: str = None):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO operation_logs
            (id, operation_type, entity_type, entity_id, before_data, after_data, operator, created_at, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            str(uuid.uuid4()),
            operation_type,
            entity_type,
            entity_id,
            json.dumps(before_data, default=str) if before_data else None,
            json.dumps(after_data, default=str) if after_data else None,
            operator,
            datetime.now().isoformat(),
            reason
        ))
        conn.commit()

    def log_import_batch(self, data_type: str, file_path: str, operator: str) -> str:
        conn = self._get_conn()
        batch_id = str(uuid.uuid4())
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_batches
            (id, data_type, file_path, status, created_at, operator)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (batch_id, data_type, file_path, 'processing', datetime.now().isoformat(), operator))
        conn.commit()
        return batch_id

    def update_import_batch(self, batch_id: str, record_count: int, success_count: int,
                           failed_count: int, status: str, error_message: str = None):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE import_batches
            SET record_count = ?, success_count = ?, failed_count = ?, status = ?, error_message = ?
            WHERE id = ?
        ''', (record_count, success_count, failed_count, status, error_message, batch_id))
        conn.commit()

    def insert_department(self, dept_id: str, name: str, window_number: str, dept_type: str):
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO departments (id, name, window_number, type, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (dept_id, name, window_number, dept_type, datetime.now().isoformat()))
            conn.commit()
            return True
        except Exception as e:
            return False

    def insert_doctor(self, doctor_id: str, name: str, department_id: str, title: str = None):
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO doctors (id, name, department_id, title, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (doctor_id, name, department_id, title, datetime.now().isoformat()))
            conn.commit()
            return True
        except Exception as e:
            return False

    def insert_doctor_status(self, doctor_id: str, status: str, reason: str, operator: str):
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO doctor_status_log
                (id, doctor_id, status, change_time, reason, operator, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()),
                doctor_id,
                status,
                datetime.now().isoformat(),
                reason,
                operator,
                datetime.now().isoformat()
            ))
            conn.commit()
            return True
        except Exception as e:
            return False

    def get_current_doctor_status(self, doctor_id: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM doctor_status_log
            WHERE doctor_id = ?
            ORDER BY change_time DESC
            LIMIT 1
        ''', (doctor_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def insert_appointment(self, appt_data: Dict) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO appointments
                (id, patient_name, patient_id, department_id, doctor_id,
                 appointment_date, appointment_time, queue_number, source_type,
                 status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                appt_data['id'],
                appt_data['patient_name'],
                appt_data.get('patient_id'),
                appt_data['department_id'],
                appt_data.get('doctor_id'),
                appt_data['appointment_date'],
                appt_data.get('appointment_time'),
                appt_data['queue_number'],
                appt_data['source_type'],
                appt_data.get('status', 'pending'),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            return False

    def get_appointment_by_queue(self, queue_number: str, dept_id: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM appointments
            WHERE queue_number = ? AND department_id = ?
        ''', (queue_number, dept_id))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_appointment_by_id(self, appt_id: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM appointments WHERE id = ?
        ''', (appt_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def update_appointment_status(self, appt_id: str, status: str):
        conn = self._get_conn()
        cursor = conn.cursor()
        before = self.get_appointment_by_id(appt_id)
        cursor.execute('''
            UPDATE appointments
            SET status = ?, updated_at = ?
            WHERE id = ?
        ''', (status, datetime.now().isoformat(), appt_id))
        conn.commit()
        after = self.get_appointment_by_id(appt_id)
        return before, after

    def insert_arrival(self, arrival_data: Dict) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO arrival_records
                (id, appointment_id, arrival_time, queue_position, created_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                arrival_data['id'],
                arrival_data['appointment_id'],
                arrival_data['arrival_time'],
                arrival_data.get('queue_position'),
                datetime.now().isoformat()
            ))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            return False

    def get_arrival_by_appointment(self, appt_id: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM arrival_records WHERE appointment_id = ?
            ORDER BY arrival_time DESC
        ''', (appt_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def insert_call_log(self, call_data: Dict) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO call_logs
                (id, appointment_id, call_time, queue_number, window_number, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                call_data['id'],
                call_data['appointment_id'],
                call_data['call_time'],
                call_data['queue_number'],
                call_data.get('window_number'),
                datetime.now().isoformat()
            ))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            return False

    def get_call_logs_by_appointment(self, appt_id: str) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM call_logs WHERE appointment_id = ?
            ORDER BY call_time
        ''', (appt_id,))
        return [dict(row) for row in cursor.fetchall()]

    def insert_overcall(self, overcall_data: Dict) -> bool:
        conn = self._get_conn()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO overcall_records
                (id, appointment_id, overcall_time, reason, new_queue_number, requeue_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                overcall_data['id'],
                overcall_data['appointment_id'],
                overcall_data['overcall_time'],
                overcall_data.get('reason'),
                overcall_data.get('new_queue_number'),
                overcall_data.get('requeue_count', 1),
                datetime.now().isoformat()
            ))
            conn.commit()
            return cursor.rowcount > 0
        except Exception as e:
            return False

    def get_overcall_count(self, appt_id: str) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT COUNT(*) as cnt FROM overcall_records
            WHERE appointment_id = ?
        ''', (appt_id,))
        row = cursor.fetchone()
        return row['cnt']

    def get_all_departments(self) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM departments')
        return [dict(row) for row in cursor.fetchall()]

    def get_all_doctors(self) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM doctors')
        return [dict(row) for row in cursor.fetchall()]

    def get_appointments_by_date(self, appt_date: str, dept_id: str = None) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        if dept_id:
            cursor.execute('''
                SELECT * FROM appointments
                WHERE appointment_date = ? AND department_id = ?
                ORDER BY queue_number
            ''', (appt_date, dept_id))
        else:
            cursor.execute('''
                SELECT * FROM appointments
                WHERE appointment_date = ?
                ORDER BY department_id, queue_number
            ''', (appt_date,))
        return [dict(row) for row in cursor.fetchall()]

    def get_pending_appointments(self, dept_id: str, appt_date: str) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT a.*, ar.arrival_time FROM appointments a
            LEFT JOIN arrival_records ar ON a.id = ar.appointment_id
            WHERE a.department_id = ? AND a.appointment_date = ?
            AND a.status IN ('pending', 'arrived', 'overcalled')
            ORDER BY a.queue_number
        ''', (dept_id, appt_date))
        return [dict(row) for row in cursor.fetchall()]

    def get_operation_logs(self, limit: int = 100) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM operation_logs
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]

    def get_import_batches(self, limit: int = 50) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM import_batches
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]

    def save_check_result(self, check_type: str, department_id: str,
                         result_summary, details: Dict) -> str:
        conn = self._get_conn()
        result_id = str(uuid.uuid4())
        cursor = conn.cursor()
        if isinstance(result_summary, dict):
            summary_str = json.dumps(result_summary, default=str)
        else:
            summary_str = str(result_summary)
        cursor.execute('''
            INSERT INTO check_results
            (id, check_type, check_time, department_id, result_summary, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            result_id,
            check_type,
            datetime.now().isoformat(),
            department_id,
            summary_str,
            json.dumps(details, default=str),
            datetime.now().isoformat()
        ))
        conn.commit()
        return result_id

    def get_check_results(self, limit: int = 20) -> List[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM check_results
            ORDER BY check_time DESC
            LIMIT ?
        ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]

    def get_check_result(self, result_id: str) -> Optional[Dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM check_results WHERE id = ?
        ''', (result_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
