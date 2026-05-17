#!/usr/bin/env python3
"""生成测试用的SQLite数据库和损坏样本"""

import sqlite3
import os
import shutil
from pathlib import Path


def create_good_db(path):
    """创建一个正常的数据库"""
    if os.path.exists(path):
        os.remove(path)
    
    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    for i in range(100):
        cursor.execute(
            "INSERT INTO users (name, email) VALUES (?, ?)",
            (f"User {i}", f"user{i}@example.com")
        )
    
    conn.commit()
    
    cursor.execute("CREATE INDEX idx_email ON users(email)")
    conn.commit()
    
    conn.close()
    print(f"✓ 创建正常数据库: {path}")


def create_db_with_wal(path):
    """创建一个带WAL文件的数据库"""
    db_path = Path(path)
    if db_path.exists():
        db_path.unlink()
    
    wal_path = db_path.with_suffix(".db-wal")
    if wal_path.exists():
        wal_path.unlink()
    
    conn = sqlite3.connect(path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA wal_autocheckpoint=0")
    
    cursor.execute("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT,
            price REAL
        )
    """)
    
    for i in range(50):
        cursor.execute(
            "INSERT INTO products (name, price) VALUES (?, ?)",
            (f"Product {i}", i * 10.5)
        )
    
    conn.commit()
    
    for i in range(50, 70):
        cursor.execute(
            "INSERT INTO products (name, price) VALUES (?, ?)",
            (f"Product {i}", i * 10.5)
        )
    
    conn.close()
    print(f"✓ 创建带WAL的数据库: {path}")
    print(f"  WAL文件: {wal_path}")


def create_corrupted_header_db(path):
    """创建一个头部损坏的数据库"""
    create_good_db(path)
    
    with open(path, "r+b") as f:
        f.write(b"CORRUPTED!")
    
    print(f"✓ 创建头部损坏的数据库: {path}")


def create_truncated_db(path):
    """创建一个被截断的数据库"""
    create_good_db(path)
    
    size = os.path.getsize(path)
    with open(path, "r+b") as f:
        f.truncate(size // 2)
    
    print(f"✓ 创建被截断的数据库: {path}")


def main():
    examples_dir = Path(__file__).parent
    
    print("生成测试数据库...")
    print("-" * 50)
    
    create_good_db(examples_dir / "good.db")
    create_db_with_wal(examples_dir / "with_wal.db")
    create_corrupted_header_db(examples_dir / "corrupted_header.db")
    create_truncated_db(examples_dir / "truncated.db")
    
    print("-" * 50)
    print("测试数据生成完成！")
    print("")
    print("运行以下命令测试工具:")
    print("  sqlite-backup-check check examples/good.db")
    print("  sqlite-backup-check check examples/with_wal.db")
    print("  sqlite-backup-check check examples/corrupted_header.db")
    print("  sqlite-backup-check check examples/truncated.db")
    print("")
    print("扫描整个目录:")
    print("  sqlite-backup-check scandir examples/")
    print("")
    print("生成报告:")
    print("  sqlite-backup-check check examples/good.db -o examples/reports/")


if __name__ == "__main__":
    main()
