import sqlite3
import os
from datetime import datetime
from typing import Optional, Dict, Any

DB_FILE = "sample_cost.db"

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_database(force: bool = False) -> Dict[str, Any]:
    result = {
        "success": False,
        "status": "",
        "history": [],
        "errors": []
    }
    
    if os.path.exists(DB_FILE) and not force:
        result["status"] = "数据库已存在"
        result["errors"].append("数据库文件已存在，使用 --force 可覆盖")
        return result
    
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
        result["history"].append({
            "timestamp": datetime.now().isoformat(),
            "action": "DELETE",
            "detail": "删除旧数据库文件"
        })
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.executescript("""
            CREATE TABLE stores (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                unit TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE batches (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                store_id TEXT NOT NULL,
                quantity REAL NOT NULL,
                unit_cost REAL NOT NULL,
                production_date DATE,
                expiry_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id),
                FOREIGN KEY (store_id) REFERENCES stores(id)
            );
            
            CREATE TABLE promotions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                store_id TEXT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id)
            );
            
            CREATE TABLE sample_records (
                id TEXT PRIMARY KEY,
                store_id TEXT NOT NULL,
                batch_id TEXT NOT NULL,
                quantity REAL NOT NULL,
                record_type TEXT NOT NULL,
                record_date DATE NOT NULL,
                promotion_id TEXT,
                reason TEXT,
                operator TEXT,
                status TEXT DEFAULT 'pending',
                import_batch_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                FOREIGN KEY (batch_id) REFERENCES batches(id),
                FOREIGN KEY (promotion_id) REFERENCES promotions(id)
            );
            
            CREATE TABLE import_batches (
                id TEXT PRIMARY KEY,
                source_file TEXT,
                record_count INTEGER,
                status TEXT DEFAULT 'processing',
                operator TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );
            
            CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                action TEXT NOT NULL,
                before_data TEXT,
                after_data TEXT,
                operator TEXT,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE validation_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sample_record_id TEXT,
                error_type TEXT NOT NULL,
                error_message TEXT NOT NULL,
                resolved BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        
        result["success"] = True
        result["status"] = "数据库初始化完成"
        result["history"].append({
            "timestamp": datetime.now().isoformat(),
            "action": "CREATE",
            "detail": "创建数据库表结构"
        })
        
    except Exception as e:
        conn.rollback()
        result["errors"].append(f"数据库初始化失败: {str(e)}")
    finally:
        conn.close()
    
    return result
