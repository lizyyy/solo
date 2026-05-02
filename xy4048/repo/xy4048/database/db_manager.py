import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import TypeVar, Type, List, Optional, Dict, Any, Union
from contextlib import contextmanager

from config import CONFIG, TaskStatus
from .models import (
    BaseModel, CoolerBox, DrugBatch, DeliveryRoute, DeliveryPoint,
    DeliveryTask, PackingItem, TemperatureReading, Attachment,
    AuditLog, AuditPackage, QuarantineRecord, ExceptionRecord,
    AttachmentType, ExceptionType
)


T = TypeVar('T', bound='BaseModel')

_db_instance: Optional['DatabaseManager'] = None


class DatabaseManager:
    def __init__(self, db_path: Union[str, Path]):
        self.db_path = Path(db_path)
        self._connection: Optional[sqlite3.Connection] = None
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def init_database(self):
        CONFIG.ensure_directories()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS cooler_boxes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    box_number TEXT NOT NULL UNIQUE,
                    device_id TEXT,
                    description TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS drug_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_number TEXT NOT NULL UNIQUE,
                    drug_name TEXT NOT NULL,
                    specification TEXT,
                    manufacturer TEXT,
                    production_date TIMESTAMP,
                    expiry_date TIMESTAMP,
                    quantity INTEGER DEFAULT 0,
                    unit TEXT DEFAULT '支',
                    storage_condition TEXT DEFAULT '2-8°C冷藏',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS delivery_routes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    route_name TEXT NOT NULL UNIQUE,
                    description TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS delivery_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    point_name TEXT NOT NULL,
                    address TEXT,
                    contact_person TEXT,
                    contact_phone TEXT,
                    route_id INTEGER,
                    is_active INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (route_id) REFERENCES delivery_routes(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS delivery_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_number TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT '待装箱',
                    cooler_box_id INTEGER,
                    route_id INTEGER,
                    delivery_point_id INTEGER,
                    pharmacist TEXT,
                    courier TEXT,
                    packing_time TIMESTAMP,
                    departure_time TIMESTAMP,
                    arrival_time TIMESTAMP,
                    sign_time TIMESTAMP,
                    archive_time TIMESTAMP,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (cooler_box_id) REFERENCES cooler_boxes(id),
                    FOREIGN KEY (route_id) REFERENCES delivery_routes(id),
                    FOREIGN KEY (delivery_point_id) REFERENCES delivery_points(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS packing_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    drug_batch_id INTEGER NOT NULL,
                    quantity INTEGER DEFAULT 0,
                    unit TEXT DEFAULT '支',
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id),
                    FOREIGN KEY (drug_batch_id) REFERENCES drug_batches(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS temperature_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    device_id TEXT NOT NULL,
                    reading_time TIMESTAMP NOT NULL,
                    temperature REAL NOT NULL,
                    box_number TEXT,
                    battery REAL,
                    is_overtemp INTEGER DEFAULT 0,
                    source_file TEXT,
                    raw_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS attachments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    attachment_type TEXT NOT NULL DEFAULT '其他',
                    original_filename TEXT NOT NULL,
                    stored_filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER DEFAULT 0,
                    sha256_hash TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    operator TEXT,
                    details TEXT,
                    ip_address TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audit_packages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    package_number TEXT NOT NULL UNIQUE,
                    temperature_risk TEXT,
                    handling_opinion TEXT,
                    attachments_hash TEXT,
                    full_hash TEXT,
                    file_path TEXT,
                    generated_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS quarantine_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_file TEXT NOT NULL,
                    row_number INTEGER DEFAULT 0,
                    raw_data TEXT,
                    error_reason TEXT,
                    error_category TEXT,
                    is_resolved INTEGER DEFAULT 0,
                    resolution_notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS exception_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER NOT NULL,
                    exception_type TEXT NOT NULL DEFAULT '其他',
                    reading_id INTEGER,
                    details TEXT,
                    is_resolved INTEGER DEFAULT 0,
                    resolution_notes TEXT,
                    resolved_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES delivery_tasks(id),
                    FOREIGN KEY (reading_id) REFERENCES temperature_readings(id)
                )
            ''')
            
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_status ON delivery_tasks(status)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_task_number ON delivery_tasks(task_number)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_readings_task_id ON temperature_readings(task_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_readings_reading_time ON temperature_readings(reading_time)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_quarantine_source ON quarantine_records(source_file)')
    
    def create(self, obj: T) -> T:
        model_class = type(obj)
        table_name = model_class.table_name()
        
        data = obj.to_dict(include_id=False)
        columns = list(data.keys())
        placeholders = ', '.join(['?' for _ in columns])
        
        query = f'''
            INSERT INTO {table_name} ({', '.join(columns)})
            VALUES ({placeholders})
        '''
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, list(data.values()))
            obj.id = cursor.lastrowid
        
        return obj
    
    def update(self, obj: T) -> T:
        if obj.id is None:
            raise ValueError("Cannot update object without id")
        
        model_class = type(obj)
        table_name = model_class.table_name()
        
        data = obj.to_dict(include_id=False)
        set_clauses = ', '.join([f"{col} = ?" for col in data.keys()])
        
        query = f'''
            UPDATE {table_name}
            SET {set_clauses}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        '''
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, list(data.values()) + [obj.id])
        
        return obj
    
    def delete(self, obj: T) -> bool:
        if obj.id is None:
            return False
        
        model_class = type(obj)
        table_name = model_class.table_name()
        
        query = f"DELETE FROM {table_name} WHERE id = ?"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, [obj.id])
            return cursor.rowcount > 0
    
    def get_by_id(self, model_class: Type[T], obj_id: int) -> Optional[T]:
        table_name = model_class.table_name()
        query = f"SELECT * FROM {table_name} WHERE id = ?"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, [obj_id])
            row = cursor.fetchone()
            if row:
                return model_class.from_dict(dict(row))
            return None
    
    def get_all(self, model_class: Type[T], where_clause: str = "", params: tuple = ()) -> List[T]:
        table_name = model_class.table_name()
        query = f"SELECT * FROM {table_name}"
        if where_clause:
            query += f" WHERE {where_clause}"
        query += " ORDER BY created_at DESC"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [model_class.from_dict(dict(row)) for row in rows]
    
    def get_by_field(self, model_class: Type[T], field: str, value: Any) -> Optional[T]:
        table_name = model_class.table_name()
        query = f"SELECT * FROM {table_name} WHERE {field} = ? LIMIT 1"
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, [value])
            row = cursor.fetchone()
            if row:
                return model_class.from_dict(dict(row))
            return None
    
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    def log_audit(self, task_id: int, action: str, operator: str = "", details: str = "", ip_address: str = ""):
        log = AuditLog(
            task_id=task_id,
            action=action,
            operator=operator,
            details=details,
            ip_address=ip_address
        )
        self.create(log)


def get_db() -> DatabaseManager:
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseManager(CONFIG.db_path)
        _db_instance.init_database()
    return _db_instance


def init_db():
    global _db_instance
    _db_instance = DatabaseManager(CONFIG.db_path)
    _db_instance.init_database()
    return _db_instance
