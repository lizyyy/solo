import sqlite3
import hashlib
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS imported_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT UNIQUE NOT NULL,
                    file_hash TEXT NOT NULL,
                    file_size INTEGER NOT NULL,
                    last_modified REAL NOT NULL,
                    imported_at TEXT NOT NULL,
                    processed_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'completed'
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS temperature_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sensor_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    temperature REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    UNIQUE(sensor_id, timestamp)
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_temp_sensor 
                ON temperature_records(sensor_id)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_temp_timestamp 
                ON temperature_records(timestamp)
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS anomaly_intervals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fridge_id TEXT NOT NULL,
                    sensor_id TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    min_temp REAL,
                    max_temp REAL,
                    avg_temp REAL,
                    anomaly_type TEXT NOT NULL,
                    is_confirmed BOOLEAN DEFAULT 0,
                    confirmed_by TEXT,
                    confirmed_at TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_anomaly_fridge 
                ON anomaly_intervals(fridge_id)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_anomaly_confirmed 
                ON anomaly_intervals(is_confirmed)
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            ''')
            
            conn.commit()

    def compute_file_hash(self, file_path: str) -> str:
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def is_file_imported(self, file_path: str) -> bool:
        file_stat = os.stat(file_path)
        file_hash = self.compute_file_hash(file_path)
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id FROM imported_files 
                WHERE file_path = ? AND file_hash = ? AND status = 'completed'
            ''', (file_path, file_hash))
            return cursor.fetchone() is not None

    def mark_file_imported(self, file_path: str, processed_count: int = 0):
        file_stat = os.stat(file_path)
        file_hash = self.compute_file_hash(file_path)
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO imported_files 
                (file_path, file_hash, file_size, last_modified, imported_at, processed_count, status)
                VALUES (?, ?, ?, ?, ?, ?, 'completed')
            ''', (file_path, file_hash, file_stat.st_size, file_stat.st_mtime, now, processed_count))
            conn.commit()

    def insert_temperature_records(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
            
        now = datetime.now().isoformat()
        inserted_count = 0
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for record in records:
                try:
                    cursor.execute('''
                        INSERT OR IGNORE INTO temperature_records 
                        (sensor_id, timestamp, temperature, created_at)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        record['sensor_id'],
                        record['timestamp'],
                        record['temperature'],
                        now
                    ))
                    if cursor.rowcount > 0:
                        inserted_count += 1
                except sqlite3.IntegrityError:
                    continue
            conn.commit()
        
        return inserted_count

    def get_latest_record(self, sensor_id: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM temperature_records 
                WHERE sensor_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''', (sensor_id,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def get_records_by_time(self, sensor_id: str, start_time: str, end_time: str) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM temperature_records 
                WHERE sensor_id = ? AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp ASC
            ''', (sensor_id, start_time, end_time))
            return [dict(row) for row in cursor.fetchall()]

    def create_anomaly_interval(self, fridge_id: str, sensor_id: str, 
                                  start_time: str, anomaly_type: str) -> int:
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO anomaly_intervals 
                (fridge_id, sensor_id, start_time, anomaly_type, created_at, is_confirmed)
                VALUES (?, ?, ?, ?, ?, 0)
            ''', (fridge_id, sensor_id, start_time, anomaly_type, now))
            conn.commit()
            return cursor.lastrowid

    def close_anomaly_interval(self, anomaly_id: int, end_time: str, 
                                min_temp: float, max_temp: float, avg_temp: float):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE anomaly_intervals 
                SET end_time = ?, min_temp = ?, max_temp = ?, avg_temp = ?
                WHERE id = ?
            ''', (end_time, min_temp, max_temp, avg_temp, anomaly_id))
            conn.commit()

    def get_open_anomalies(self, fridge_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if fridge_id:
                cursor.execute('''
                    SELECT * FROM anomaly_intervals 
                    WHERE fridge_id = ? AND end_time IS NULL
                    ORDER BY start_time DESC
                ''', (fridge_id,))
            else:
                cursor.execute('''
                    SELECT * FROM anomaly_intervals 
                    WHERE end_time IS NULL
                    ORDER BY start_time DESC
                ''')
            return [dict(row) for row in cursor.fetchall()]

    def get_anomalies(self, fridge_id: Optional[str] = None, 
                       confirmed: Optional[bool] = None,
                       limit: int = 100) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM anomaly_intervals WHERE 1=1'
            params = []
            
            if fridge_id:
                query += ' AND fridge_id = ?'
                params.append(fridge_id)
            
            if confirmed is not None:
                query += ' AND is_confirmed = ?'
                params.append(1 if confirmed else 0)
            
            query += ' ORDER BY start_time DESC LIMIT ?'
            params.append(limit)
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def confirm_anomaly(self, anomaly_id: int, confirmed_by: str, notes: str = ''):
        now = datetime.now().isoformat()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE anomaly_intervals 
                SET is_confirmed = 1, confirmed_by = ?, confirmed_at = ?, notes = ?
                WHERE id = ?
            ''', (confirmed_by, now, notes, anomaly_id))
            conn.commit()

    def get_import_state(self, key: str, default: str = '') -> str:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM import_state WHERE key = ?', (key,))
            row = cursor.fetchone()
            return row['value'] if row else default

    def set_import_state(self, key: str, value: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO import_state (key, value)
                VALUES (?, ?)
            ''', (key, value))
            conn.commit()
