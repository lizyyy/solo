import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

import os
DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'firmware_gray.db')

class BatchStatus(Enum):
    CREATED = "created"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ROLLED_BACK = "rolled_back"

class UpgradeStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"

@dataclass
class DeviceModel:
    id: Optional[int]
    model_name: str
    model_code: str
    description: str
    created_at: str

@dataclass
class FirmwareVersion:
    id: Optional[int]
    model_id: int
    version: str
    file_path: str
    md5: str
    size: int
    release_notes: str
    created_at: str

@dataclass
class GrayBatch:
    id: Optional[int]
    name: str
    model_id: int
    firmware_id: int
    target_devices: int
    current_devices: int
    success_count: int
    failed_count: int
    status: str
    pause_threshold: float
    pause_reason: Optional[str]
    rollback_strategy: str
    created_at: str
    started_at: Optional[str]
    completed_at: Optional[str]

@dataclass
class UpgradeReceipt:
    id: Optional[int]
    batch_id: int
    device_sn: str
    status: str
    error_code: Optional[str]
    error_message: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: str

@dataclass
class PauseRule:
    id: Optional[int]
    batch_id: int
    rule_type: str
    threshold: float
    enabled: bool
    created_at: str

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL,
            model_code TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS firmware_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER NOT NULL,
            version TEXT NOT NULL,
            file_path TEXT,
            md5 TEXT,
            size INTEGER,
            release_notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (model_id) REFERENCES device_models(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS gray_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            model_id INTEGER NOT NULL,
            firmware_id INTEGER NOT NULL,
            target_devices INTEGER NOT NULL DEFAULT 0,
            current_devices INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            pause_threshold REAL NOT NULL DEFAULT 0.1,
            pause_reason TEXT,
            rollback_strategy TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            FOREIGN KEY (model_id) REFERENCES device_models(id),
            FOREIGN KEY (firmware_id) REFERENCES firmware_versions(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS upgrade_receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            device_sn TEXT NOT NULL,
            status TEXT NOT NULL,
            error_code TEXT,
            error_message TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (batch_id) REFERENCES gray_batches(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pause_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            rule_type TEXT NOT NULL,
            threshold REAL NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            FOREIGN KEY (batch_id) REFERENCES gray_batches(id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def row_to_dict(row: sqlite3.Row) -> Dict:
    return dict(row) if row else None

def rows_to_list(rows) -> List[Dict]:
    return [dict(row) for row in rows]
