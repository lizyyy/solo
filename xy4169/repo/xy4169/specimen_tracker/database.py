"""数据库持久化层

使用 SQLite 进行本地数据存储，提供完整的 CRUD 操作。
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Iterator
from collections import defaultdict

from .models import (
    Patient, Specimen, SpecimenEvent, Anomaly,
    SpecimenStatus, EventType, AnomalyType
)


def datetime_to_str(dt: datetime) -> str:
    """将 datetime 转换为 ISO 格式字符串"""
    return dt.isoformat()


def str_to_datetime(s: Optional[str]) -> Optional[datetime]:
    """将 ISO 格式字符串转换为 datetime"""
    if s is None:
        return None
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


class DatabaseManager:
    """数据库管理器
    
    封装所有数据库操作，提供统一的接口。
    """
    
    SCHEMA_VERSION = 1
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._connection: Optional[sqlite3.Connection] = None
    
    def initialize_database(self) -> bool:
        """初始化数据库，创建必要的表"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    age INTEGER DEFAULT 0,
                    gender TEXT DEFAULT '',
                    bed_number TEXT DEFAULT '',
                    admission_number TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS specimens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    specimen_no TEXT NOT NULL UNIQUE,
                    patient_id TEXT NOT NULL,
                    patient_name TEXT NOT NULL,
                    location TEXT DEFAULT '',
                    specimen_type TEXT DEFAULT '',
                    operation_room TEXT DEFAULT '',
                    surgeon TEXT DEFAULT '',
                    status TEXT NOT NULL,
                    photo_count INTEGER DEFAULT 0,
                    has_csv INTEGER DEFAULT 0,
                    has_specimen_bag INTEGER DEFAULT 0,
                    phone_remark TEXT DEFAULT '',
                    urgent_level TEXT DEFAULT '常规',
                    registered_at TEXT NOT NULL,
                    reviewed_at TEXT,
                    released_at TEXT,
                    due_time TEXT,
                    reviewed_by TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS specimen_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    specimen_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    operator TEXT DEFAULT '',
                    event_time TEXT NOT NULL,
                    details TEXT DEFAULT '',
                    FOREIGN KEY (specimen_id) REFERENCES specimens(id)
                )
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS anomalies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    specimen_id INTEGER NOT NULL,
                    anomaly_type TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    severity TEXT DEFAULT 'high',
                    detected_at TEXT NOT NULL,
                    resolved_at TEXT,
                    resolved_by TEXT DEFAULT '',
                    resolution TEXT DEFAULT '',
                    is_resolved INTEGER DEFAULT 0,
                    FOREIGN KEY (specimen_id) REFERENCES specimens(id)
                )
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_specimens_status ON specimens(status)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_specimens_patient ON specimens(patient_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_events_specimen ON specimen_events(specimen_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON anomalies(is_resolved)
            """)
            
            cursor.execute("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1")
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                    (self.SCHEMA_VERSION, datetime_to_str(datetime.now()))
                )
            
            conn.commit()
            return True
    
    @contextmanager
    def _get_connection(self) -> Iterator[sqlite3.Connection]:
        """获取数据库连接的上下文管理器"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def save_patient(self, patient: Patient) -> int:
        """保存患者信息（存在则更新，不存在则插入）"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime_to_str(datetime.now())
            
            if patient.id:
                cursor.execute("""
                    UPDATE patients SET
                        patient_id=?, name=?, age=?, gender=?,
                        bed_number=?, admission_number=?, updated_at=?
                    WHERE id=?
                """, (
                    patient.patient_id, patient.name, patient.age, patient.gender,
                    patient.bed_number, patient.admission_number, now, patient.id
                ))
            else:
                cursor.execute("""
                    INSERT INTO patients 
                    (patient_id, name, age, gender, bed_number, admission_number, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    patient.patient_id, patient.name, patient.age, patient.gender,
                    patient.bed_number, patient.admission_number, now, now
                ))
                patient.id = cursor.lastrowid
            
            conn.commit()
            return patient.id
    
    def get_patient_by_id(self, patient_id: str) -> Optional[Patient]:
        """根据患者ID获取患者信息"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM patients WHERE patient_id=?", (patient_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_patient(row)
            return None
    
    def save_specimen(self, specimen: Specimen) -> int:
        """保存标本信息（存在则更新，不存在则插入）"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            now = datetime_to_str(datetime.now())
            
            if specimen.id:
                cursor.execute("""
                    UPDATE specimens SET
                        specimen_no=?, patient_id=?, patient_name=?, location=?,
                        specimen_type=?, operation_room=?, surgeon=?, status=?,
                        photo_count=?, has_csv=?, has_specimen_bag=?, phone_remark=?,
                        urgent_level=?, registered_at=?, reviewed_at=?, released_at=?,
                        due_time=?, reviewed_by=?, updated_at=?
                    WHERE id=?
                """, (
                    specimen.specimen_no, specimen.patient_id, specimen.patient_name,
                    specimen.location, specimen.specimen_type, specimen.operation_room,
                    specimen.surgeon, specimen.status.value, specimen.photo_count,
                    1 if specimen.has_csv else 0, 1 if specimen.has_specimen_bag else 0,
                    specimen.phone_remark, specimen.urgent_level,
                    datetime_to_str(specimen.registered_at),
                    datetime_to_str(specimen.reviewed_at) if specimen.reviewed_at else None,
                    datetime_to_str(specimen.released_at) if specimen.released_at else None,
                    datetime_to_str(specimen.due_time) if specimen.due_time else None,
                    specimen.reviewed_by, now, specimen.id
                ))
            else:
                cursor.execute("""
                    INSERT INTO specimens 
                    (specimen_no, patient_id, patient_name, location, specimen_type,
                     operation_room, surgeon, status, photo_count, has_csv, has_specimen_bag,
                     phone_remark, urgent_level, registered_at, reviewed_at, released_at,
                     due_time, reviewed_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    specimen.specimen_no, specimen.patient_id, specimen.patient_name,
                    specimen.location, specimen.specimen_type, specimen.operation_room,
                    specimen.surgeon, specimen.status.value, specimen.photo_count,
                    1 if specimen.has_csv else 0, 1 if specimen.has_specimen_bag else 0,
                    specimen.phone_remark, specimen.urgent_level,
                    datetime_to_str(specimen.registered_at),
                    datetime_to_str(specimen.reviewed_at) if specimen.reviewed_at else None,
                    datetime_to_str(specimen.released_at) if specimen.released_at else None,
                    datetime_to_str(specimen.due_time) if specimen.due_time else None,
                    specimen.reviewed_by, now, now
                ))
                specimen.id = cursor.lastrowid
            
            conn.commit()
            return specimen.id
    
    def get_specimen_by_id(self, specimen_id: int) -> Optional[Specimen]:
        """根据数据库ID获取标本"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM specimens WHERE id=?", (specimen_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_specimen(row)
            return None
    
    def get_specimen_by_no(self, specimen_no: str) -> Optional[Specimen]:
        """根据标本号获取标本"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM specimens WHERE specimen_no=?", (specimen_no,))
            row = cursor.fetchone()
            if row:
                return self._row_to_specimen(row)
            return None
    
    def get_all_specimens(self, include_released: bool = False) -> List[Specimen]:
        """获取所有标本
        
        Args:
            include_released: 是否包含已放行的标本
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if include_released:
                cursor.execute("SELECT * FROM specimens ORDER BY registered_at DESC")
            else:
                cursor.execute("""
                    SELECT * FROM specimens 
                    WHERE status != ? 
                    ORDER BY registered_at DESC
                """, (SpecimenStatus.RELEASED.value,))
            
            return [self._row_to_specimen(row) for row in cursor.fetchall()]
    
    def get_specimens_by_status(self, status: SpecimenStatus) -> List[Specimen]:
        """根据状态获取标本列表"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM specimens WHERE status=? ORDER BY registered_at DESC
            """, (status.value,))
            return [self._row_to_specimen(row) for row in cursor.fetchall()]
    
    def save_event(self, event: SpecimenEvent) -> int:
        """保存事件"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if event.id:
                cursor.execute("""
                    UPDATE specimen_events SET
                        specimen_id=?, event_type=?, description=?,
                        operator=?, event_time=?, details=?
                    WHERE id=?
                """, (
                    event.specimen_id, event.event_type.value, event.description,
                    event.operator, datetime_to_str(event.event_time), event.details, event.id
                ))
            else:
                cursor.execute("""
                    INSERT INTO specimen_events 
                    (specimen_id, event_type, description, operator, event_time, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    event.specimen_id, event.event_type.value, event.description,
                    event.operator, datetime_to_str(event.event_time), event.details
                ))
                event.id = cursor.lastrowid
            
            conn.commit()
            return event.id
    
    def get_events_by_specimen(self, specimen_id: int) -> List[SpecimenEvent]:
        """获取指定标本的所有事件（按时间排序）"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM specimen_events 
                WHERE specimen_id=? ORDER BY event_time ASC
            """, (specimen_id,))
            return [self._row_to_event(row) for row in cursor.fetchall()]
    
    def save_anomaly(self, anomaly: Anomaly) -> int:
        """保存异常记录"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            if anomaly.id:
                cursor.execute("""
                    UPDATE anomalies SET
                        specimen_id=?, anomaly_type=?, description=?, severity=?,
                        detected_at=?, resolved_at=?, resolved_by=?, resolution=?, is_resolved=?
                    WHERE id=?
                """, (
                    anomaly.specimen_id, anomaly.anomaly_type.value, anomaly.description,
                    anomaly.severity, datetime_to_str(anomaly.detected_at),
                    datetime_to_str(anomaly.resolved_at) if anomaly.resolved_at else None,
                    anomaly.resolved_by, anomaly.resolution,
                    1 if anomaly.is_resolved else 0, anomaly.id
                ))
            else:
                cursor.execute("""
                    INSERT INTO anomalies 
                    (specimen_id, anomaly_type, description, severity, detected_at,
                     resolved_at, resolved_by, resolution, is_resolved)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    anomaly.specimen_id, anomaly.anomaly_type.value, anomaly.description,
                    anomaly.severity, datetime_to_str(anomaly.detected_at),
                    datetime_to_str(anomaly.resolved_at) if anomaly.resolved_at else None,
                    anomaly.resolved_by, anomaly.resolution,
                    1 if anomaly.is_resolved else 0
                ))
                anomaly.id = cursor.lastrowid
            
            conn.commit()
            return anomaly.id
    
    def get_unresolved_anomalies(self) -> List[Anomaly]:
        """获取所有未解决的异常"""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM anomalies WHERE is_resolved=0 ORDER BY detected_at DESC
            """)
            return [self._row_to_anomaly(row) for row in cursor.fetchall()]
    
    def _row_to_patient(self, row: sqlite3.Row) -> Patient:
        """将数据库行转换为 Patient 对象"""
        return Patient(
            id=row['id'],
            patient_id=row['patient_id'],
            name=row['name'],
            age=row['age'],
            gender=row['gender'],
            bed_number=row['bed_number'],
            admission_number=row['admission_number'],
            created_at=str_to_datetime(row['created_at']) or datetime.now(),
            updated_at=str_to_datetime(row['updated_at']) or datetime.now(),
        )
    
    def _row_to_specimen(self, row: sqlite3.Row) -> Specimen:
        """将数据库行转换为 Specimen 对象"""
        return Specimen(
            id=row['id'],
            specimen_no=row['specimen_no'],
            patient_id=row['patient_id'],
            patient_name=row['patient_name'],
            location=row['location'],
            specimen_type=row['specimen_type'],
            operation_room=row['operation_room'],
            surgeon=row['surgeon'],
            status=SpecimenStatus(row['status']),
            photo_count=row['photo_count'],
            has_csv=bool(row['has_csv']),
            has_specimen_bag=bool(row['has_specimen_bag']),
            phone_remark=row['phone_remark'],
            urgent_level=row['urgent_level'],
            registered_at=str_to_datetime(row['registered_at']) or datetime.now(),
            reviewed_at=str_to_datetime(row['reviewed_at']),
            released_at=str_to_datetime(row['released_at']),
            due_time=str_to_datetime(row['due_time']),
            reviewed_by=row['reviewed_by'],
            created_at=str_to_datetime(row['created_at']) or datetime.now(),
            updated_at=str_to_datetime(row['updated_at']) or datetime.now(),
        )
    
    def _row_to_event(self, row: sqlite3.Row) -> SpecimenEvent:
        """将数据库行转换为 SpecimenEvent 对象"""
        return SpecimenEvent(
            id=row['id'],
            specimen_id=row['specimen_id'],
            event_type=EventType(row['event_type']),
            description=row['description'],
            operator=row['operator'],
            event_time=str_to_datetime(row['event_time']) or datetime.now(),
            details=row['details'],
        )
    
    def _row_to_anomaly(self, row: sqlite3.Row) -> Anomaly:
        """将数据库行转换为 Anomaly 对象"""
        return Anomaly(
            id=row['id'],
            specimen_id=row['specimen_id'],
            anomaly_type=AnomalyType(row['anomaly_type']),
            description=row['description'],
            severity=row['severity'],
            detected_at=str_to_datetime(row['detected_at']) or datetime.now(),
            resolved_at=str_to_datetime(row['resolved_at']),
            resolved_by=row['resolved_by'],
            resolution=row['resolution'],
            is_resolved=bool(row['is_resolved']),
        )
