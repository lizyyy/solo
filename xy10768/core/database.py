import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from .config import settings

def init_db():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT UNIQUE NOT NULL,
            owner TEXT NOT NULL,
            data_count INTEGER NOT NULL,
            transform_steps TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            source_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS validation_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            is_valid BOOLEAN NOT NULL,
            errors TEXT,
            warnings TEXT,
            dirty_data_count INTEGER DEFAULT 0,
            intercepted_replay_range TEXT,
            validation_summary TEXT,
            validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES batches (batch_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS failed_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            node_name TEXT NOT NULL,
            error_message TEXT,
            failed_count INTEGER DEFAULT 1,
            occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES batches (batch_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS replay_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            replay_range TEXT,
            replay_nodes TEXT,
            status TEXT NOT NULL,
            before_summary TEXT,
            after_summary TEXT,
            operator TEXT,
            replayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (batch_id) REFERENCES batches (batch_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_sample_data():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM batches")
    count = cursor.fetchone()['count']
    
    if count > 0:
        conn.close()
        return
    
    sample_batches = [
        {
            "batch_id": "BATCH-2024-001",
            "owner": "张三",
            "data_count": 1500,
            "transform_steps": json.dumps(["数据抽取", "数据清洗", "数据转换"]),
            "status": "failed",
            "source_data": json.dumps({
                "records": [
                    {"id": 1, "name": "正常数据1", "value": 100},
                    {"id": 2, "name": None, "value": "invalid"},
                    {"id": 3, "name": "正常数据2", "value": 200},
                    {"id": 4, "name": "", "value": -50},
                    {"id": 5, "name": "正常数据3", "value": 300}
                ]
            })
        },
        {
            "batch_id": "BATCH-2024-002",
            "owner": "李四",
            "data_count": 2300,
            "transform_steps": json.dumps(["数据抽取", "数据清洗", "数据转换", "数据加载"]),
            "status": "validated",
            "source_data": json.dumps({
                "records": [
                    {"id": 1, "name": "订单A", "amount": 1500},
                    {"id": 2, "name": "订单B", "amount": 2500}
                ]
            })
        },
        {
            "batch_id": "BATCH-2024-003",
            "owner": "王五",
            "data_count": 800,
            "transform_steps": json.dumps(["数据抽取", "质量校验"]),
            "status": "failed",
            "source_data": json.dumps({
                "records": [
                    {"id": 1, "name": "测试", "value": None},
                    {"id": 2, "name": "测试2", "value": "abc"}
                ]
            })
        }
    ]
    
    for batch in sample_batches:
        cursor.execute('''
            INSERT INTO batches (batch_id, owner, data_count, transform_steps, status, source_data)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            batch["batch_id"],
            batch["owner"],
            batch["data_count"],
            batch["transform_steps"],
            batch["status"],
            batch["source_data"]
        ))
    
    sample_validations = [
        {
            "batch_id": "BATCH-2024-001",
            "is_valid": False,
            "errors": json.dumps(["字段name存在空值", "字段value类型不匹配", "存在负值数据"]),
            "warnings": json.dumps(["部分数据格式不规范"]),
            "dirty_data_count": 2,
            "intercepted_replay_range": json.dumps({"start": 2, "end": 4, "reason": "包含脏数据，需先清洗"}),
            "validation_summary": json.dumps({
                "total_records": 5,
                "valid_records": 3,
                "dirty_records": 2,
                "dirty_rate": "40%",
                "issues": [
                    {"type": "空值", "count": 1, "fields": ["name"]},
                    {"type": "类型错误", "count": 1, "fields": ["value"]},
                    {"type": "负值异常", "count": 1, "fields": ["value"]}
                ]
            })
        },
        {
            "batch_id": "BATCH-2024-003",
            "is_valid": False,
            "errors": json.dumps(["关键字段缺失值", "数值字段包含非数字"]),
            "warnings": json.dumps([]),
            "dirty_data_count": 2,
            "intercepted_replay_range": json.dumps({"start": 1, "end": 2, "reason": "全部数据异常，需重新抽取"}),
            "validation_summary": json.dumps({
                "total_records": 2,
                "valid_records": 0,
                "dirty_records": 2,
                "dirty_rate": "100%",
                "issues": [
                    {"type": "空值", "count": 1, "fields": ["value"]},
                    {"type": "类型错误", "count": 1, "fields": ["value"]}
                ]
            })
        }
    ]
    
    for validation in sample_validations:
        cursor.execute('''
            INSERT INTO validation_results (batch_id, is_valid, errors, warnings, dirty_data_count, intercepted_replay_range, validation_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            validation["batch_id"],
            validation["is_valid"],
            validation["errors"],
            validation["warnings"],
            validation["dirty_data_count"],
            validation["intercepted_replay_range"],
            validation["validation_summary"]
        ))
    
    sample_failed_nodes = [
        {"batch_id": "BATCH-2024-001", "node_name": "数据清洗", "error_message": "空值处理失败，存在未预期的None值", "failed_count": 3},
        {"batch_id": "BATCH-2024-001", "node_name": "数据转换", "error_message": "类型转换失败，无法将字符串转为数字", "failed_count": 1},
        {"batch_id": "BATCH-2024-003", "node_name": "质量校验", "error_message": "数据完整性校验不通过", "failed_count": 2}
    ]
    
    for node in sample_failed_nodes:
        cursor.execute('''
            INSERT INTO failed_nodes (batch_id, node_name, error_message, failed_count)
            VALUES (?, ?, ?, ?)
        ''', (node["batch_id"], node["node_name"], node["error_message"], node["failed_count"]))
    
    sample_replay_logs = [
        {
            "batch_id": "BATCH-2024-001",
            "replay_range": json.dumps({"start": 1, "end": 3}),
            "replay_nodes": json.dumps(["数据清洗"]),
            "status": "completed",
            "before_summary": json.dumps({"dirty_count": 2, "valid_count": 1}),
            "after_summary": json.dumps({"dirty_count": 0, "valid_count": 3}),
            "operator": "张三"
        }
    ]
    
    for log in sample_replay_logs:
        cursor.execute('''
            INSERT INTO replay_logs (batch_id, replay_range, replay_nodes, status, before_summary, after_summary, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            log["batch_id"],
            log["replay_range"],
            log["replay_nodes"],
            log["status"],
            log["before_summary"],
            log["after_summary"],
            log["operator"]
        ))
    
    conn.commit()
    conn.close()
