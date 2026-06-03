import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = "inventory_analysis.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teacher_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT NOT NULL,
            original_line_number INTEGER NOT NULL,
            original_content TEXT NOT NULL,
            comment_text TEXT NOT NULL,
            import_batch_id TEXT NOT NULL,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            UNIQUE(source_file, original_line_number, import_batch_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sampling_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sample_id TEXT NOT NULL,
            sample_name TEXT NOT NULL,
            comment_id INTEGER,
            supplementary_note TEXT,
            supplementary_operator TEXT,
            supplementary_at TIMESTAMP,
            is_deleted INTEGER DEFAULT 0,
            FOREIGN KEY (comment_id) REFERENCES teacher_comments(id),
            UNIQUE(sample_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processing_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            comment_id INTEGER NOT NULL,
            current_status TEXT NOT NULL,
            boundary_value REAL,
            threshold_value REAL,
            is_boundary_case INTEGER DEFAULT 0,
            needs_teacher_review INTEGER DEFAULT 0,
            teacher_review_result TEXT,
            teacher_reviewer TEXT,
            teacher_review_at TIMESTAMP,
            assistant_operator TEXT,
            assistant_note TEXT,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comment_id) REFERENCES teacher_comments(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS change_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            operator TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            operation_note TEXT,
            operated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (record_id) REFERENCES processing_records(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_batches (
            batch_id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            imported_by TEXT NOT NULL,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            record_count INTEGER DEFAULT 0
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS boundary_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT NOT NULL UNIQUE,
            rule_description TEXT NOT NULL,
            threshold_value REAL NOT NULL,
            comparison_type TEXT NOT NULL,
            boundary_handling TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    conn.commit()
    conn.close()
    
    _init_boundary_rules()


def _init_boundary_rules():
    conn = get_connection()
    cursor = conn.cursor()
    
    rules = [
        (
            'inventory_volatility_normal',
            '库存波动率小于阈值判为正常，等于阈值需老师复核',
            0.15,
            'less_than',
            'teacher_review_when_equal'
        ),
        (
            'inventory_volatility_abnormal',
            '库存波动率大于阈值判为异常，等于阈值需老师复核',
            0.15,
            'greater_than',
            'teacher_review_when_equal'
        )
    ]
    
    for rule_name, desc, threshold, comp_type, handling in rules:
        cursor.execute('''
            INSERT OR IGNORE INTO boundary_rules 
            (rule_name, rule_description, threshold_value, comparison_type, boundary_handling)
            VALUES (?, ?, ?, ?, ?)
        ''', (rule_name, desc, threshold, comp_type, handling))
    
    conn.commit()
    conn.close()
