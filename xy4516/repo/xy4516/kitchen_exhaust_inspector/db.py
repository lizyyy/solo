import sqlite3
import os
from pathlib import Path

DB_PATH = Path(os.environ.get('KITCHEN_INSPECTOR_DB', 'kitchen_inspector.db'))

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """初始化数据库表"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 创建门店表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_code TEXT UNIQUE NOT NULL,
            store_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建巡检批次表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inspection_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_name TEXT NOT NULL,
            inspection_month TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(batch_name, inspection_month)
        )
    ''')
    
    # 创建文件记录表（用于跟踪所有导入的文件）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_type TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id)
        )
    ''')
    
    # 创建清洗记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cleaning_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            store_code TEXT NOT NULL,
            cleaning_date TEXT NOT NULL,
            cleaning_company TEXT,
            technician_name TEXT,
            next_cleaning_date TEXT,
            file_record_id INTEGER,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
            FOREIGN KEY (file_record_id) REFERENCES file_records(id)
        )
    ''')
    
    # 创建传感器读数表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sensor_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            store_code TEXT NOT NULL,
            reading_date TEXT NOT NULL,
            reading_time TEXT,
            pm25 REAL,
            pm10 REAL,
            oil_concentration REAL,
            temperature REAL,
            humidity REAL,
            file_record_id INTEGER,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
            FOREIGN KEY (file_record_id) REFERENCES file_records(id)
        )
    ''')
    
    # 创建照片记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS photo_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            store_code TEXT NOT NULL,
            photo_path TEXT NOT NULL,
            photo_hash TEXT NOT NULL,
            photo_type TEXT,  -- 烟道入口、烟道出口、净化器前后等
            taken_date TEXT,
            file_record_id INTEGER,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
            FOREIGN KEY (file_record_id) REFERENCES file_records(id)
        )
    ''')
    
    # 创建整改预约表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rectifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            store_code TEXT NOT NULL,
            issue_description TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            deadline_date TEXT,
            status TEXT DEFAULT 'pending',  -- pending, in_progress, completed, overdue
            completion_date TEXT,
            file_record_id INTEGER,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id),
            FOREIGN KEY (file_record_id) REFERENCES file_records(id)
        )
    ''')
    
    # 创建风险记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS risks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            store_code TEXT NOT NULL,
            risk_type TEXT NOT NULL,
            risk_level TEXT NOT NULL,  -- high, medium, low
            description TEXT NOT NULL,
            related_record_type TEXT,
            related_record_id INTEGER,
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES inspection_batches(id)
        )
    ''')
    
    # 创建复核记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            risk_id INTEGER NOT NULL,
            reviewer TEXT NOT NULL,
            review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            review_result TEXT NOT NULL,  -- confirmed, false_alarm, resolved
            comments TEXT,
            FOREIGN KEY (risk_id) REFERENCES risks(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"数据库初始化完成: {DB_PATH.absolute()}")
