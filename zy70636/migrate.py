"""
数据库自动迁移脚本
检测 SQLite 表结构缺失的字段并自动添加，支持零停机升级
"""
import sqlite3
from sqlalchemy import create_engine, text


def get_existing_columns(db_path, table_name):
    """获取表中已存在的列"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(f'PRAGMA table_info({table_name})')
    columns = [col[1] for col in cursor.fetchall()]
    cursor.close()
    conn.close()
    return columns


def migrate_audit_logs(db_path="weighing.db"):
    """迁移 audit_logs 表，添加缺失的字段"""
    existing_columns = get_existing_columns(db_path, "audit_logs")
    
    if not existing_columns:
        print("⚠ audit_logs 表不存在，将由 create_all() 自动创建")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    migrations = [
        ("is_success", "INTEGER DEFAULT 1"),
        ("error_message", "VARCHAR(500)"),
        ("weighing_id", "INTEGER"),  # 兼容旧版本，确保字段存在
    ]
    
    for column_name, column_def in migrations:
        if column_name not in existing_columns:
            try:
                sql = f"ALTER TABLE audit_logs ADD COLUMN {column_name} {column_def}"
                cursor.execute(sql)
                print(f"✓ 已添加字段: audit_logs.{column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    print(f"⚠ 添加字段 audit_logs.{column_name} 时出错: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()


def migrate_weighing_records(db_path="weighing.db"):
    """确保 weighing_records 表所有字段兼容"""
    existing_columns = get_existing_columns(db_path, "weighing_records")
    
    if not existing_columns:
        print("⚠ weighing_records 表不存在，将由 create_all() 自动创建")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    expected_columns = [
        ("status", "VARCHAR(20) DEFAULT 'weighed'"),
        ("price_id", "INTEGER"),
        ("deduction_id", "INTEGER"),
        ("deducted_weight", "FLOAT"),
        ("final_weight", "FLOAT"),
        ("settlement_id", "INTEGER"),
        ("created_by", "VARCHAR(50)"),
        ("remarks", "TEXT"),
    ]
    
    for column_name, column_def in expected_columns:
        if column_name not in existing_columns:
            try:
                sql = f"ALTER TABLE weighing_records ADD COLUMN {column_name} {column_def}"
                cursor.execute(sql)
                print(f"✓ 已添加字段: weighing_records.{column_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    print(f"⚠ 添加字段 weighing_records.{column_name} 时出错: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()


def migrate_all(db_path="weighing.db"):
    """执行所有迁移"""
    print(f"\n======== 开始数据库迁移: {db_path} ========")
    
    try:
        migrate_audit_logs(db_path)
        migrate_weighing_records(db_path)
        print("======== 数据库迁移完成 ========\n")
        return True
    except Exception as e:
        print(f"✗ 迁移失败: {e}")
        return False


def verify_migration(db_path="weighing.db"):
    """验证迁移结果"""
    print("\n======== 验证表结构 ========")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('PRAGMA table_info(audit_logs)')
    columns = cursor.fetchall()
    print("audit_logs 表字段:")
    for col in columns:
        print(f"  - {col[1]}: {col[2]}")
    
    cursor.close()
    conn.close()
    
    print("======== 验证完成 ========\n")


if __name__ == "__main__":
    import sys
    
    db_file = sys.argv[1] if len(sys.argv) > 1 else "weighing.db"
    
    migrate_all(db_file)
    verify_migration(db_file)
