import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from config.settings import get_settings


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            settings = get_settings()
            db_path = settings.db_path
        self.db_path = db_path
        self._conn: Optional[sqlite3.Connection] = None
    
    def connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(
                self.db_path,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
            )
            self._conn.row_factory = sqlite3.Row
        return self._conn
    
    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None
    
    @contextmanager
    def cursor(self):
        conn = self.connect()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
    
    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor
    
    def execute_script(self, script: str) -> None:
        with self.cursor() as cursor:
            cursor.executescript(script)
    
    def init_schema(self) -> None:
        schema = """
        -- 患者表
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            id_card TEXT,
            diagnosis TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 订单表
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            order_number TEXT UNIQUE NOT NULL,
            body_part TEXT NOT NULL,
            side TEXT NOT NULL CHECK(side IN ('左侧', '右侧', '双侧')),
            status TEXT NOT NULL DEFAULT '待取模' 
                CHECK(status IN ('待取模', '待设计', '制作中', '待试穿', '需返修', '已交付')),
            impression_date DATE,
            technician TEXT,
            follow_up_date DATE,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        );
        
        -- 尺寸版本表
        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            dimensions TEXT NOT NULL,  -- JSON格式存储尺寸数据
            technician TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        
        -- 附件表
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            sha256_hash TEXT NOT NULL,
            category TEXT,
            notes TEXT,
            is_missing INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        
        -- 试穿记录表
        CREATE TABLE IF NOT EXISTS fitting_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            fitting_date DATE NOT NULL,
            technician TEXT,
            feedback TEXT,
            adjustments TEXT,
            next_follow_up DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );
        
        -- 返修记录表
        CREATE TABLE IF NOT EXISTS rework_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            fitting_record_id INTEGER NOT NULL,
            rework_reason TEXT NOT NULL,
            rework_details TEXT,
            technician TEXT,
            rework_date DATE,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (fitting_record_id) REFERENCES fitting_records(id)
        );
        
        -- 审计日志表
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            old_value TEXT,
            new_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 索引
        CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
        CREATE INDEX IF NOT EXISTS idx_measurements_order ON measurements(order_id);
        CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_logs(order_id);
        """
        
        self.execute_script(schema)


_db_instance: Optional[Database] = None


def get_db() -> Database:
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance


def init_db() -> None:
    db = get_db()
    db.init_schema()
