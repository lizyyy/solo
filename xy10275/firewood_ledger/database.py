"""
数据库模块 - 处理SQLite数据库连接和初始化
"""

import sqlite3
import os
from pathlib import Path


class Database:
    """数据库管理器"""
    
    def __init__(self, db_path: str = None):
        """初始化数据库连接"""
        if db_path is None:
            # 默认使用当前目录下的data文件夹
            data_dir = Path.cwd() / "data"
            data_dir.mkdir(exist_ok=True)
            db_path = str(data_dir / "firewood_ledger.db")
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()
    
    def _init_tables(self):
        """初始化所有表结构"""
        cursor = self.conn.cursor()
        
        # 房间表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_number TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                floor INTEGER DEFAULT 1,
                max_guests INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 炉具表 - 不同类型炉具消耗不同
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stoves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL,
                stove_type TEXT NOT NULL,
                model TEXT,
                daily_consumption_kg REAL NOT NULL DEFAULT 5.0,
                is_active INTEGER DEFAULT 1,
                installed_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id),
                UNIQUE(room_id, stove_type)
            )
        ''')
        
        # 入住记录表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stays (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stay_code TEXT NOT NULL UNIQUE,
                room_id INTEGER NOT NULL,
                guest_name TEXT,
                guest_count INTEGER DEFAULT 1,
                check_in_date TEXT NOT NULL,
                check_out_date TEXT,
                status TEXT DEFAULT 'checked_in',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            )
        ''')
        
        # 柴火入库表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS firewood_in (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_code TEXT NOT NULL UNIQUE,
                delivery_date TEXT NOT NULL,
                weight_kg REAL NOT NULL,
                wood_type TEXT,
                supplier TEXT,
                unit_price REAL,
                total_cost REAL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 消耗核算结果表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS consumption (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stay_id INTEGER NOT NULL,
                stove_id INTEGER NOT NULL,
                consumption_date TEXT NOT NULL,
                days_used INTEGER DEFAULT 1,
                estimated_kg REAL NOT NULL,
                actual_kg REAL,
                verification_status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stay_id) REFERENCES stays(id),
                FOREIGN KEY (stove_id) REFERENCES stoves(id),
                UNIQUE(stay_id, stove_id, consumption_date)
            )
        ''')
        
        # 导入记录日志 - 用于追踪重复导入
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_type TEXT NOT NULL,
                source_file TEXT,
                record_count INTEGER,
                success_count INTEGER,
                duplicate_count INTEGER,
                error_count INTEGER,
                status TEXT DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.conn.commit()
    
    def execute(self, query: str, params: tuple = None):
        """执行SQL查询"""
        cursor = self.conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        self.conn.commit()
        return cursor
    
    def query(self, query: str, params: tuple = None):
        """执行查询并返回结果"""
        cursor = self.conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor.fetchall()
    
    def query_one(self, query: str, params: tuple = None):
        """执行查询并返回单条结果"""
        cursor = self.conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        return cursor.fetchone()
    
    def close(self):
        """关闭数据库连接"""
        self.conn.close()
