import sqlite3
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict


@dataclass
class TemperatureLog:
    id: Optional[int]
    device_id: str
    timestamp: str
    temperature: float
    created_at: str


@dataclass
class DoorEvent:
    id: Optional[int]
    device_id: str
    timestamp: str
    event_type: str
    duration_seconds: Optional[int]
    created_at: str


@dataclass
class VaccineBatch:
    id: Optional[int]
    batch_number: str
    vaccine_name: str
    manufacturer: str
    storage_min_temp: float
    storage_max_temp: float
    receive_time: str
    expiry_date: str
    created_at: str


@dataclass
class VaccinationRecord:
    id: Optional[int]
    vaccination_id: str
    patient_name: str
    patient_phone: str
    batch_number: str
    vaccination_time: str
    created_at: str


@dataclass
class ManualReview:
    id: Optional[int]
    anomaly_id: str
    reviewer: str
    review_time: str
    original_result: str
    review_reason: str
    final_result: str
    impact_change: str
    created_at: str


DB_FILE = "cold_chain.db"


def get_db_path() -> str:
    return os.path.join(os.getcwd(), DB_FILE)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS temperature_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            temperature REAL NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(device_id, timestamp)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS door_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            duration_seconds INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE(device_id, timestamp, event_type)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vaccine_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_number TEXT UNIQUE NOT NULL,
            vaccine_name TEXT NOT NULL,
            manufacturer TEXT NOT NULL,
            storage_min_temp REAL NOT NULL,
            storage_max_temp REAL NOT NULL,
            receive_time TEXT NOT NULL,
            expiry_date TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vaccination_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vaccination_id TEXT UNIQUE NOT NULL,
            patient_name TEXT NOT NULL,
            patient_phone TEXT NOT NULL,
            batch_number TEXT NOT NULL,
            vaccination_time TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS manual_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anomaly_id TEXT NOT NULL,
            reviewer TEXT NOT NULL,
            review_time TEXT NOT NULL,
            original_result TEXT NOT NULL,
            review_reason TEXT NOT NULL,
            final_result TEXT NOT NULL,
            impact_change TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_temp_device_time ON temperature_logs(device_id, timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_door_device_time ON door_events(device_id, timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vaccine_batch ON vaccine_batches(batch_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_vaccination_batch ON vaccination_records(batch_number)")

    conn.commit()
    conn.close()


def insert_temperature_log(log: TemperatureLog) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO temperature_logs 
            (device_id, timestamp, temperature, created_at)
            VALUES (?, ?, ?, ?)
        """, (log.device_id, log.timestamp, log.temperature, log.created_at))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def insert_door_event(event: DoorEvent) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO door_events 
            (device_id, timestamp, event_type, duration_seconds, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (event.device_id, event.timestamp, event.event_type, event.duration_seconds, event.created_at))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def insert_vaccine_batch(batch: VaccineBatch) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO vaccine_batches 
            (batch_number, vaccine_name, manufacturer, storage_min_temp, 
             storage_max_temp, receive_time, expiry_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (batch.batch_number, batch.vaccine_name, batch.manufacturer,
              batch.storage_min_temp, batch.storage_max_temp, batch.receive_time,
              batch.expiry_date, batch.created_at))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def insert_vaccination_record(record: VaccinationRecord) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO vaccination_records 
            (vaccination_id, patient_name, patient_phone, batch_number, 
             vaccination_time, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (record.vaccination_id, record.patient_name, record.patient_phone,
              record.batch_number, record.vaccination_time, record.created_at))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def insert_manual_review(review: ManualReview) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO manual_reviews 
            (anomaly_id, reviewer, review_time, original_result, 
             review_reason, final_result, impact_change, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (review.anomaly_id, review.reviewer, review.review_time,
              review.original_result, review.review_reason, 
              review.final_result, review.impact_change, review.created_at))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def get_temperature_logs(device_id: str = None, start_time: str = None, end_time: str = None) -> List[TemperatureLog]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM temperature_logs WHERE 1=1"
    params = []
    
    if device_id:
        query += " AND device_id = ?"
        params.append(device_id)
    if start_time:
        query += " AND timestamp >= ?"
        params.append(start_time)
    if end_time:
        query += " AND timestamp <= ?"
        params.append(end_time)
    
    query += " ORDER BY timestamp ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [TemperatureLog(**dict(row)) for row in rows]


def get_vaccine_batch(batch_number: str) -> Optional[VaccineBatch]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vaccine_batches WHERE batch_number = ?", (batch_number,))
    row = cursor.fetchone()
    conn.close()
    
    return VaccineBatch(**dict(row)) if row else None


def get_all_vaccine_batches() -> List[VaccineBatch]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vaccine_batches ORDER BY receive_time DESC")
    rows = cursor.fetchall()
    conn.close()
    
    return [VaccineBatch(**dict(row)) for row in rows]


def get_vaccination_records(batch_number: str = None) -> List[VaccinationRecord]:
    conn = get_connection()
    cursor = conn.cursor()
    
    if batch_number:
        cursor.execute("SELECT * FROM vaccination_records WHERE batch_number = ? ORDER BY vaccination_time ASC", 
                      (batch_number,))
    else:
        cursor.execute("SELECT * FROM vaccination_records ORDER BY vaccination_time ASC")
    
    rows = cursor.fetchall()
    conn.close()
    
    return [VaccinationRecord(**dict(row)) for row in rows]


def get_door_events(device_id: str = None, start_time: str = None, end_time: str = None) -> List[DoorEvent]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM door_events WHERE 1=1"
    params = []
    
    if device_id:
        query += " AND device_id = ?"
        params.append(device_id)
    if start_time:
        query += " AND timestamp >= ?"
        params.append(start_time)
    if end_time:
        query += " AND timestamp <= ?"
        params.append(end_time)
    
    query += " ORDER BY timestamp ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [DoorEvent(**dict(row)) for row in rows]


def get_manual_reviews(anomaly_id: str = None) -> List[ManualReview]:
    conn = get_connection()
    cursor = conn.cursor()
    
    if anomaly_id:
        cursor.execute("SELECT * FROM manual_reviews WHERE anomaly_id = ? ORDER BY review_time DESC", 
                      (anomaly_id,))
    else:
        cursor.execute("SELECT * FROM manual_reviews ORDER BY review_time DESC")
    
    rows = cursor.fetchall()
    conn.close()
    
    return [ManualReview(**dict(row)) for row in rows]


def get_all_device_ids() -> List[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT device_id FROM temperature_logs ORDER BY device_id")
    rows = cursor.fetchall()
    conn.close()
    
    return [row[0] for row in rows]


def get_stats() -> Dict[str, int]:
    conn = get_connection()
    cursor = conn.cursor()
    
    stats = {}
    cursor.execute("SELECT COUNT(*) FROM temperature_logs")
    stats['temperature_logs'] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM door_events")
    stats['door_events'] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM vaccine_batches")
    stats['vaccine_batches'] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM vaccination_records")
    stats['vaccination_records'] = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM manual_reviews")
    stats['manual_reviews'] = cursor.fetchone()[0]
    
    conn.close()
    return stats
