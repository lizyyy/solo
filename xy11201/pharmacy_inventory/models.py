import sqlite3
import json
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict


class ProductType(Enum):
    VACCINE = "vaccine"
    INSULIN = "insulin"


class RecordStatus(Enum):
    PENDING = "pending"
    RECEIVED = "received"
    ISOLATED = "isolated"
    REVIEWED = "reviewed"
    RELEASED = "released"
    RETURNED = "returned"


class AbnormalType(Enum):
    NORMAL = "normal"
    TEMPERATURE_ABNORMAL = "temperature_abnormal"
    PACKAGE_DAMAGED = "package_damaged"
    EXPIRED = "expired"
    OTHER = "other"


@dataclass
class InventoryRecord:
    id: Optional[int]
    batch_no: str
    product_type: str
    product_name: str
    quantity: int
    temperature: float
    receiver: str
    receive_time: datetime
    is_damaged: bool
    damage_description: str
    status: str
    abnormal_type: str
    handler: Optional[str]
    handle_time: Optional[datetime]
    handle_notes: str
    created_at: datetime
    updated_at: datetime
    operation_idempotency_key: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        return data


class Database:
    def __init__(self, db_path: str = "pharmacy_inventory.db"):
        self.db_path = db_path
        self._init_tables()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_tables(self):
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_no VARCHAR(100) NOT NULL,
            product_type VARCHAR(50) NOT NULL,
            product_name VARCHAR(200) NOT NULL,
            quantity INTEGER NOT NULL,
            temperature DECIMAL(5,2) NOT NULL,
            receiver VARCHAR(100) NOT NULL,
            receive_time DATETIME NOT NULL,
            is_damaged BOOLEAN DEFAULT FALSE,
            damage_description TEXT,
            status VARCHAR(50) NOT NULL,
            abnormal_type VARCHAR(50) NOT NULL,
            handler VARCHAR(100),
            handle_time DATETIME,
            handle_notes TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            operation_idempotency_key VARCHAR(200),
            UNIQUE(batch_no, product_type)
        )
        ''')

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER,
            operation VARCHAR(50) NOT NULL,
            operator VARCHAR(100) NOT NULL,
            operation_time DATETIME NOT NULL,
            idempotency_key VARCHAR(200),
            details TEXT,
            success BOOLEAN DEFAULT TRUE,
            error_message TEXT,
            FOREIGN KEY (record_id) REFERENCES inventory_records(id)
        )
        ''')

        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_records(batch_no, product_type)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_status ON inventory_records(status)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_receiver ON inventory_records(receiver)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_receive_time ON inventory_records(receive_time)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_abnormal_type ON inventory_records(abnormal_type)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_idempotency ON inventory_records(operation_idempotency_key)
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_log_idempotency ON operation_logs(idempotency_key)
        ''')

        conn.commit()
        conn.close()

    def create_record(self, record: InventoryRecord) -> InventoryRecord:
        conn = self._get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        record.created_at = now
        record.updated_at = now

        cursor.execute('''
        INSERT INTO inventory_records (
            batch_no, product_type, product_name, quantity, temperature,
            receiver, receive_time, is_damaged, damage_description,
            status, abnormal_type, handler, handle_time, handle_notes,
            created_at, updated_at, operation_idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.batch_no, record.product_type, record.product_name,
            record.quantity, record.temperature, record.receiver,
            record.receive_time.isoformat(), record.is_damaged,
            record.damage_description, record.status, record.abnormal_type,
            record.handler, record.handle_time.isoformat() if record.handle_time else None,
            record.handle_notes, record.created_at.isoformat(),
            record.updated_at.isoformat(), record.operation_idempotency_key
        ))

        record.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return record

    def get_record_by_batch(self, batch_no: str, product_type: str) -> Optional[InventoryRecord]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM inventory_records WHERE batch_no = ? AND product_type = ?
        ''', (batch_no, product_type))
        row = cursor.fetchone()
        conn.close()
        return self._row_to_record(row) if row else None

    def get_record_by_idempotency_key(self, key: str) -> Optional[InventoryRecord]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM inventory_records WHERE operation_idempotency_key = ?
        ''', (key,))
        row = cursor.fetchone()
        conn.close()
        return self._row_to_record(row) if row else None

    def update_record_status(self, record_id: int, status: str, handler: str,
                             notes: str = '', abnormal_type: str = None) -> bool:
        conn = self._get_connection()
        cursor = conn.cursor()
        now = datetime.now().isoformat()

        update_fields = ['status = ?', 'handler = ?', 'handle_time = ?',
                        'handle_notes = ?', 'updated_at = ?']
        params = [status, handler, now, notes, now, record_id]

        if abnormal_type:
            update_fields.append('abnormal_type = ?')
            params.insert(-1, abnormal_type)

        query = f'''
        UPDATE inventory_records SET {', '.join(update_fields)} WHERE id = ?
        '''

        cursor.execute(query, params)
        affected = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return affected

    def log_operation(self, record_id: Optional[int], operation: str, operator: str,
                      idempotency_key: str, success: bool = True,
                      error_message: str = None, details: dict = None):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO operation_logs (
            record_id, operation, operator, operation_time,
            idempotency_key, details, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record_id, operation, operator, datetime.now().isoformat(),
            idempotency_key, json.dumps(details) if details else None,
            success, error_message
        ))
        conn.commit()
        conn.close()

    def get_operation_log(self, idempotency_key: str) -> Optional[sqlite3.Row]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
        SELECT * FROM operation_logs WHERE idempotency_key = ? AND success = TRUE
        ''', (idempotency_key,))
        row = cursor.fetchone()
        conn.close()
        return row

    def query_records(self, receiver: str = None, status: str = None,
                      start_time: datetime = None, end_time: datetime = None,
                      abnormal_type: str = None, product_type: str = None) -> List[InventoryRecord]:
        conn = self._get_connection()
        cursor = conn.cursor()

        query = 'SELECT * FROM inventory_records WHERE 1=1'
        params = []

        if receiver:
            query += ' AND receiver = ?'
            params.append(receiver)
        if status:
            query += ' AND status = ?'
            params.append(status)
        if start_time:
            query += ' AND receive_time >= ?'
            params.append(start_time.isoformat())
        if end_time:
            query += ' AND receive_time <= ?'
            params.append(end_time.isoformat())
        if abnormal_type:
            query += ' AND abnormal_type = ?'
            params.append(abnormal_type)
        if product_type:
            query += ' AND product_type = ?'
            params.append(product_type)

        query += ' ORDER BY receive_time DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [self._row_to_record(row) for row in rows]

    def _row_to_record(self, row) -> InventoryRecord:
        def parse_dt(value):
            if value:
                if isinstance(value, str):
                    return datetime.fromisoformat(value)
                return value
            return None

        return InventoryRecord(
            id=row['id'],
            batch_no=row['batch_no'],
            product_type=row['product_type'],
            product_name=row['product_name'],
            quantity=row['quantity'],
            temperature=row['temperature'],
            receiver=row['receiver'],
            receive_time=parse_dt(row['receive_time']),
            is_damaged=row['is_damaged'],
            damage_description=row['damage_description'] or '',
            status=row['status'],
            abnormal_type=row['abnormal_type'],
            handler=row['handler'],
            handle_time=parse_dt(row['handle_time']),
            handle_notes=row['handle_notes'] or '',
            created_at=parse_dt(row['created_at']),
            updated_at=parse_dt(row['updated_at']),
            operation_idempotency_key=row['operation_idempotency_key']
        )
