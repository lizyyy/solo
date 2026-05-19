import sqlite3
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

class OperationType(Enum):
    RECEIVE = "receive"
    INSTALL = "install"
    RETURN = "return"
    CLAIM = "claim"
    WRITE_OFF = "write_off"

class OperationStatus(Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"

class PartStatus(Enum):
    IN_STOCK = "in_stock"
    ISSUED = "issued"
    INSTALLED = "installed"
    RETURNED = "returned"
    CLAIMED = "claimed"
    WRITTEN_OFF = "written_off"

@dataclass
class AuditInfo:
    operator_id: str
    operator_name: str
    role: str
    operation_time: datetime = field(default_factory=datetime.now)

@dataclass
class Part:
    part_code: str
    part_name: str
    quantity: int
    status: PartStatus = PartStatus.IN_STOCK
    id: Optional[int] = None

@dataclass
class OperationRecord:
    operation_id: str
    operation_type: OperationType
    operator_id: str
    operator_name: str
    role: str
    operation_time: datetime
    status: OperationStatus
    details: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    id: Optional[int] = None

@dataclass
class StockFlow:
    part_code: str
    operation_type: OperationType
    quantity: int
    operation_id: str
    operator_id: str
    operation_time: datetime
    id: Optional[int] = None

class Database:
    def __init__(self, db_path: str = "warehouse.db"):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS parts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_code TEXT UNIQUE NOT NULL,
                part_name TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'in_stock',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operation_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_id TEXT UNIQUE NOT NULL,
                operation_type TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                operator_name TEXT NOT NULL,
                role TEXT NOT NULL,
                operation_time TIMESTAMP NOT NULL,
                status TEXT NOT NULL,
                details TEXT,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS stock_flows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_code TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                operation_id TEXT NOT NULL,
                operator_id TEXT NOT NULL,
                operation_time TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (operation_id) REFERENCES operation_records(operation_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS part_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_code TEXT NOT NULL,
                operation_id TEXT NOT NULL,
                receive_id TEXT,
                install_id TEXT,
                return_id TEXT,
                claim_id TEXT,
                write_off_id TEXT,
                quantity INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (operation_id) REFERENCES operation_records(operation_id)
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_operation_id ON operation_records(operation_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_part_code ON parts(part_code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_flow_op ON stock_flows(operation_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_part_ops_part ON part_operations(part_code)")
        
        conn.commit()
        conn.close()
