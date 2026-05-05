from typing import Dict, Any, Optional
from datetime import datetime
import json
import os

from .database import SessionLocal, engine, Base
from .models import (
    AnalysisTask, InputSnapshot, DiagnosisResult, ExportRecord,
    TaskStatus, AnalysisType, SeverityLevel, ExportFormat
)
from .schemas import TaskCreate, InputSnapshotCreate
from .services import TaskService, AnalysisService, ExportService
from .config import settings, ensure_directories


def init_database():
    Base.metadata.create_all(bind=engine)
    ensure_directories()


def seed_sample_tasks() -> list:
    db = SessionLocal()
    created_tasks = []
    
    try:
        task1 = _create_sample_task_1(db)
        created_tasks.append(task1)
        
        task2 = _create_sample_task_2(db)
        created_tasks.append(task2)
        
        print(f"Seed 数据创建完成，共 {len(created_tasks)} 个任务")
        
    finally:
        db.close()
    
    return created_tasks


def _create_sample_task_1(db) -> AnalysisTask:
    task_service = TaskService(db)
    
    task_data = TaskCreate(
        name="生产环境性能诊断 - 订单系统",
        description="对订单系统的数据库性能进行全面诊断，包括连接池、索引、慢查询等分析",
        config={
            "enabled_analyses": [
                "connection_pool",
                "index_analysis",
                "slow_sql",
                "read_write_split"
            ],
            "connection_pool": {
                "max_connections": 200,
                "current_connections": 180,
                "wait_timeout": 100
            },
            "index_analysis": {
                "analyze_missing_indexes": True,
                "analyze_redundant_indexes": True
            },
            "slow_sql": {
                "slow_query_threshold": 1.0,
                "top_n_queries": 20
            }
        }
    )
    
    task = task_service.create_task(task_data)
    
    db_profile = {
        "max_connections": 200,
        "current_connections": 180,
        "active_connections": 120,
        "wait_timeout": 100,
        "read_ratio": 0.6,
        "master_write_ratio": 0.95,
        "slave_read_count": 3000,
        "master_read_count": 7000,
        "misrouted_reads": 1500,
        "slow_reads_on_master": 25,
        "replication_lag_ms": 2500,
        "slave_availability": 0.92
    }
    
    snapshot1 = InputSnapshotCreate(
        snapshot_type="db_profile",
        content=json.dumps(db_profile, ensure_ascii=False),
        metadata={"source": "production_monitor", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot1)
    
    schema_sql = """
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_no VARCHAR(64) NOT NULL,
    status INT DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id)
);

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE INDEX uk_username (username),
    INDEX idx_email (email)
);

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(256) NOT NULL,
    category_id INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    stock INT NOT NULL,
    INDEX idx_category (category_id)
);
"""
    
    snapshot2 = InputSnapshotCreate(
        snapshot_type="schema_sql",
        content=schema_sql,
        metadata={"source": "database_dump", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot2)
    
    slow_sql_log = """# Time: 2024-01-15T10:05:00
# User@Host: app_user@app_server
# Query_time: 12.3456  Lock_time: 0.0012  Rows_sent: 1  Rows_examined: 100000
SELECT * FROM orders WHERE status = 1 ORDER BY created_at DESC;

# Time: 2024-01-15T10:06:00
# User@Host: app_user@app_server
# Query_time: 8.1234  Lock_time: 0.0008  Rows_sent: 50  Rows_examined: 50000
SELECT * FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (SELECT id FROM orders WHERE user_id = 12345);

# Time: 2024-01-15T10:07:00
# User@Host: app_user@app_server
# Query_time: 5.6789  Lock_time: 0.0005  Rows_sent: 100  Rows_examined: 20000
SELECT * FROM products WHERE category_id = 5 AND stock > 0 ORDER BY price ASC LIMIT 100;

# Time: 2024-01-15T10:08:00
# User@Host: app_user@app_server
# Query_time: 35.1234  Lock_time: 0.0020  Rows_sent: 1000  Rows_examined: 500000
SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.created_at >= '2024-01-01' ORDER BY o.created_at DESC;
"""
    
    snapshot3 = InputSnapshotCreate(
        snapshot_type="slow_sql_log",
        content=slow_sql_log,
        metadata={"source": "slow_query_log", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot3)
    
    print(f"任务 '{task.name}' 创建完成，ID: {task.id}")
    
    analysis_service = AnalysisService(db)
    analysis_service.run_analysis(task.id)
    
    return task


def _create_sample_task_2(db) -> AnalysisTask:
    task_service = TaskService(db)
    
    task_data = TaskCreate(
        name="测试环境优化对比 - 优化后",
        description="优化后的配置与优化前的对比分析任务",
        config={
            "enabled_analyses": [
                "connection_pool",
                "batch_write",
                "index_analysis",
                "sharding_hotspot"
            ],
            "connection_pool": {
                "max_connections": 300,
                "current_connections": 150,
                "wait_timeout": 28800
            },
            "batch_write": {
                "batch_size": 2000,
                "total_records": 100000
            },
            "sharding_hotspot": {
                "shard_count": 4,
                "hotspot_threshold": 0.3
            }
        }
    )
    
    task = task_service.create_task(task_data)
    
    db_profile = {
        "max_connections": 300,
        "current_connections": 150,
        "active_connections": 100,
        "wait_timeout": 28800,
        "shard_count": 4,
        "data_distribution": {
            "shard_1": 12000,
            "shard_2": 11500,
            "shard_3": 13000,
            "shard_4": 12500
        },
        "query_distribution": {
            "shard_1": 5500,
            "shard_2": 5200,
            "shard_3": 5800,
            "shard_4": 5400
        },
        "shard_key": "user_id"
    }
    
    snapshot1 = InputSnapshotCreate(
        snapshot_type="db_profile",
        content=json.dumps(db_profile, ensure_ascii=False),
        metadata={"source": "test_environment", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot1)
    
    batch_sample = {
        "batch_size": 2000,
        "total_records": 100000,
        "single_insert_time_ms": 4.5,
        "batch_insert_time_ms": 80
    }
    
    snapshot2 = InputSnapshotCreate(
        snapshot_type="batch_write_sample",
        content=json.dumps(batch_sample, ensure_ascii=False),
        metadata={"source": "benchmark_test", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot2)
    
    schema_sql = """
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_no VARCHAR(64) NOT NULL,
    status INT DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_user_id (user_id),
    INDEX idx_status_created (status, created_at),
    INDEX idx_created_at (created_at)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    INDEX idx_order_product (order_id, product_id)
);
"""
    
    snapshot3 = InputSnapshotCreate(
        snapshot_type="schema_sql",
        content=schema_sql,
        metadata={"source": "optimized_schema", "timestamp": datetime.utcnow().isoformat()}
    )
    task_service.add_snapshot(task.id, snapshot3)
    
    print(f"任务 '{task.name}' 创建完成，ID: {task.id}")
    
    analysis_service = AnalysisService(db)
    analysis_service.run_analysis(task.id)
    
    return task


def clear_all_data():
    db = SessionLocal()
    try:
        db.query(ExportRecord).delete()
        db.query(DiagnosisResult).delete()
        db.query(InputSnapshot).delete()
        db.query(AnalysisTask).delete()
        db.commit()
        print("所有数据已清除")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "clear":
        clear_all_data()
    else:
        init_database()
        seed_sample_tasks()
