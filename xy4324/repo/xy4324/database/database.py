#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQLite数据库管理
"""

import sqlite3
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime

from config import get_config

_db_instance = None

def get_db():
    """获取数据库连接实例（单例模式）"""
    global _db_instance
    if _db_instance is None:
        config = get_config()
        config.ensure_directories()
        _db_instance = sqlite3.connect(
            str(config.db_path),
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
            check_same_thread=False
        )
        _db_instance.row_factory = sqlite3.Row
    return _db_instance

@contextmanager
def DatabaseContext():
    """数据库上下文管理器，自动提交或回滚"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e

def init_database():
    """初始化数据库表结构"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 启用外键支持
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # 1. 试剂库存表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reagents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            english_name TEXT,
            cas_number TEXT,
            formula TEXT,
            category TEXT NOT NULL,
            danger_level INTEGER DEFAULT 3,
            concentration TEXT,
            purity TEXT,
            unit TEXT NOT NULL DEFAULT '克',
            total_quantity REAL NOT NULL DEFAULT 0,
            available_quantity REAL NOT NULL DEFAULT 0,
            minimum_quantity REAL DEFAULT 0,
            location TEXT,
            shelf TEXT,
            expiry_date DATE,
            manufacturer TEXT,
            batch_number TEXT,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    # 2. 班级表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grade TEXT NOT NULL,
            class_number TEXT NOT NULL,
            student_count INTEGER DEFAULT 0,
            teacher_name TEXT,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(grade, class_number)
        )
    ''')
    
    # 3. 实验预约表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL,
            experiment_name TEXT NOT NULL,
            teacher_name TEXT NOT NULL,
            booking_date DATE NOT NULL,
            experiment_date DATE NOT NULL,
            student_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES classes(id)
        )
    ''')
    
    # 4. 预约明细（预约需要的试剂）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS booking_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            reagent_id INTEGER NOT NULL,
            requested_quantity REAL NOT NULL,
            issued_quantity REAL DEFAULT 0,
            returned_quantity REAL DEFAULT 0,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id),
            FOREIGN KEY (reagent_id) REFERENCES reagents(id)
        )
    ''')
    
    # 5. 审批记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            approver_name TEXT NOT NULL,
            approval_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id)
        )
    ''')
    
    # 6. 领用记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            collector_name TEXT NOT NULL,
            collection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id)
        )
    ''')
    
    # 7. 归还记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            returner_name TEXT NOT NULL,
            return_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id)
        )
    ''')
    
    # 8. 归还明细
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS return_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            booking_item_id INTEGER NOT NULL,
            returned_quantity REAL NOT NULL,
            condition TEXT,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (return_id) REFERENCES returns(id),
            FOREIGN KEY (booking_item_id) REFERENCES booking_items(id)
        )
    ''')
    
    # 9. 安全检查日志
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS safety_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            check_type TEXT NOT NULL,
            result TEXT NOT NULL,
            details TEXT,
            blocking BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (booking_id) REFERENCES bookings(id)
        )
    ''')
    
    # 10. 审计日志
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT,
            action TEXT NOT NULL,
            table_name TEXT,
            record_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            details TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reagents_name ON reagents(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reagents_category ON reagents(category)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_reagents_danger ON reagents(danger_level)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(experiment_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)')
    
    # 创建更新时间触发器
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_reagents_timestamp 
        AFTER UPDATE ON reagents
        BEGIN
            UPDATE reagents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    ''')
    
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_bookings_timestamp 
        AFTER UPDATE ON bookings
        BEGIN
            UPDATE bookings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    ''')
    
    cursor.execute('''
        CREATE TRIGGER IF NOT EXISTS update_classes_timestamp 
        AFTER UPDATE ON classes
        BEGIN
            UPDATE classes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
    ''')
    
    conn.commit()
    return True

def create_sample_data():
    """创建示例数据"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 检查是否已有数据
    cursor.execute("SELECT COUNT(*) FROM reagents")
    if cursor.fetchone()[0] > 0:
        return False  # 已有数据，不重复创建
    
    # 示例班级
    classes_data = [
        ("高一", "1班", 45, "张老师", "普通班"),
        ("高一", "2班", 48, "李老师", "实验班"),
        ("高一", "3班", 42, "王老师", "普通班"),
        ("高二", "1班", 40, "赵老师", "理科班"),
        ("高二", "2班", 38, "陈老师", "理科班"),
    ]
    
    cursor.executemany('''
        INSERT INTO classes (grade, class_number, student_count, teacher_name, remarks)
        VALUES (?, ?, ?, ?, ?)
    ''', classes_data)
    
    # 示例试剂
    reagents_data = [
        # 高危险
        ("浓硫酸", "Sulfuric acid", "7664-93-9", "H2SO4", "acid", 1, "98%", "AR", "毫升", 5000, 5000, 500, "A柜", "A1-1", "2027-12-31", "国药集团", "20240101", "强腐蚀性，需双人双锁"),
        ("浓盐酸", "Hydrochloric acid", "7647-01-0", "HCl", "acid", 1, "37%", "AR", "毫升", 8000, 8000, 1000, "A柜", "A1-2", "2027-06-30", "国药集团", "20240201", "强腐蚀性，挥发性"),
        ("浓硝酸", "Nitric acid", "7697-37-2", "HNO3", "acid", 1, "65%", "AR", "毫升", 3000, 3000, 300, "A柜", "A1-3", "2027-09-30", "国药集团", "20240115", "强氧化性，强腐蚀性"),
        ("氢氧化钠", "Sodium hydroxide", "1310-73-2", "NaOH", "base", 1, "96%", "AR", "克", 5000, 5000, 500, "B柜", "B1-1", "2028-03-31", "国药集团", "20240120", "强腐蚀性，易潮解"),
        ("高锰酸钾", "Potassium permanganate", "7722-64-7", "KMnO4", "oxidizer", 1, "99%", "AR", "克", 2000, 2000, 200, "C柜", "C1-1", "2027-11-30", "国药集团", "20240210", "强氧化剂，遇酸易分解"),
        
        # 中危险
        ("30%双氧水", "Hydrogen peroxide", "7722-84-1", "H2O2", "oxidizer", 2, "30%", "AR", "毫升", 2500, 2500, 250, "C柜", "C1-2", "2026-08-31", "国药集团", "20240301", "氧化剂，易分解"),
        ("无水乙醇", "Ethanol absolute", "64-17-5", "C2H5OH", "organic", 2, "99.7%", "AR", "毫升", 10000, 10000, 1000, "D柜", "D1-1", "2027-05-31", "国药集团", "20240125", "易燃液体"),
        ("丙酮", "Acetone", "67-64-1", "CH3COCH3", "organic", 2, "99.5%", "AR", "毫升", 5000, 5000, 500, "D柜", "D1-2", "2027-07-31", "国药集团", "20240220", "易燃易挥发"),
        ("锌粒", "Zinc", "7440-66-6", "Zn", "metal", 2, "99%", "AR", "克", 3000, 3000, 300, "E柜", "E1-1", "2029-01-31", "国药集团", "20240130", "遇酸产生氢气"),
        ("铜粉", "Copper", "7440-50-8", "Cu", "metal", 2, "99%", "AR", "克", 2000, 2000, 200, "E柜", "E1-2", "2029-02-28", "国药集团", "20240205", "需密封保存"),
        
        # 低危险
        ("氯化钠", "Sodium chloride", "7647-14-5", "NaCl", "salt", 3, "99.5%", "AR", "克", 10000, 10000, 1000, "F柜", "F1-1", "2030-06-30", "国药集团", "20240110", "普通盐类"),
        ("硫酸铜", "Copper sulfate", "7758-98-7", "CuSO4", "salt", 3, "99%", "AR", "克", 5000, 5000, 500, "F柜", "F1-2", "2028-12-31", "国药集团", "20240112", "蓝色晶体"),
        ("碳酸钠", "Sodium carbonate", "497-19-8", "Na2CO3", "salt", 3, "99%", "AR", "克", 8000, 8000, 800, "B柜", "B1-2", "2029-04-30", "国药集团", "20240215", "纯碱"),
        ("碳酸氢钠", "Sodium bicarbonate", "144-55-8", "NaHCO3", "salt", 3, "99%", "AR", "克", 6000, 6000, 600, "B柜", "B1-3", "2029-03-31", "国药集团", "20240218", "小苏打"),
        
        # 一般
        ("酚酞指示剂", "Phenolphthalein", "77-09-8", "C20H14O4", "indicator", 4, "1%", "指示剂", "毫升", 1000, 1000, 100, "G柜", "G1-1", "2027-10-31", "国药集团", "20240305", "酸碱指示剂"),
        ("石蕊试液", "Litmus", "1393-92-6", "", "indicator", 4, "", "指示剂", "毫升", 500, 500, 50, "G柜", "G1-2", "2027-08-31", "国药集团", "20240310", "酸碱指示剂"),
        ("蒸馏水", "Distilled water", "7732-18-5", "H2O", "water", 4, "", "试剂级", "升", 20000, 20000, 5000, "H区", "H1-1", "2028-01-31", "自制", "20240101", "实验室自制"),
    ]
    
    cursor.executemany('''
        INSERT INTO reagents (name, english_name, cas_number, formula, category, 
                              danger_level, concentration, purity, unit, total_quantity, 
                              available_quantity, minimum_quantity, location, shelf, 
                              expiry_date, manufacturer, batch_number, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', reagents_data)
    
    # 示例预约
    today = datetime.now().strftime("%Y-%m-%d")
    
    cursor.execute('''
        INSERT INTO bookings (class_id, experiment_name, teacher_name, booking_date, 
                             experiment_date, student_count, status, remarks)
        VALUES (1, "粗盐提纯", "张老师", ?, ?, 45, "approved", "基础化学实验")
    ''', (today, today))
    
    booking_id = cursor.lastrowid
    
    # 预约项目
    cursor.execute('''
        INSERT INTO booking_items (booking_id, reagent_id, requested_quantity, issued_quantity, remarks)
        VALUES (?, (SELECT id FROM reagents WHERE name='氯化钠'), 50, 50, "每组约1克")
    ''', (booking_id,))
    
    cursor.execute('''
        INSERT INTO booking_items (booking_id, reagent_id, requested_quantity, issued_quantity, remarks)
        VALUES (?, (SELECT id FROM reagents WHERE name='蒸馏水'), 2, 2, "每组约40毫升")
    ''', (booking_id,))
    
    # 审批记录
    cursor.execute('''
        INSERT INTO approvals (booking_id, approver_name, status, comments)
        VALUES (?, "管理员", "approved", "试剂充足，安全检查通过")
    ''', (booking_id,))
    
    conn.commit()
    return True
