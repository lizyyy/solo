#!/usr/bin/env python3
import sqlite3
import random
from datetime import datetime, timedelta
import os


def create_test_database(db_path: str = './examples/test_db.sqlite'):
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("正在创建测试数据库...")
    
    cursor.execute('''
    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        status TEXT NOT NULL,
        total_amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE transactions (
        txn_id INTEGER PRIMARY KEY,
        account_id INTEGER NOT NULL,
        txn_date TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    statuses = ['PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PROCESSING']
    
    print("正在生成 orders 表数据...")
    order_records = []
    for i in range(1, 1001):
        customer_id = random.randint(1, 100)
        if i <= 700:
            days_ago = random.randint(730, 2000)
        else:
            days_ago = random.randint(1, 729)
        order_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        status = random.choice(statuses)
        total_amount = round(random.uniform(10, 5000), 2)
        
        order_records.append((i, customer_id, order_date, status, total_amount))
    
    cursor.executemany(
        'INSERT INTO orders (order_id, customer_id, order_date, status, total_amount) VALUES (?, ?, ?, ?, ?)',
        order_records
    )
    
    txn_statuses = ['PENDING', 'SETTLED', 'FAILED', 'REVERSED']
    
    print("正在生成 transactions 表数据...")
    txn_records = []
    for i in range(1, 2001):
        account_id = random.randint(1, 50)
        if i <= 1400:
            days_ago = random.randint(730, 2000)
        else:
            days_ago = random.randint(1, 729)
        txn_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
        amount = round(random.uniform(-1000, 5000), 2)
        status = random.choice(txn_statuses)
        description = f"Transaction #{i}"
        
        txn_records.append((i, account_id, txn_date, amount, status, description))
    
    cursor.executemany(
        'INSERT INTO transactions (txn_id, account_id, txn_date, amount, status, description) VALUES (?, ?, ?, ?, ?, ?)',
        txn_records
    )
    
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM orders")
    order_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM transactions")
    txn_count = cursor.fetchone()[0]
    
    print(f"\n测试数据库创建成功: {db_path}")
    print(f"  orders 表: {order_count} 条记录")
    print(f"  transactions 表: {txn_count} 条记录")
    
    cursor.execute("SELECT status, COUNT(*) as cnt FROM orders GROUP BY status")
    print("\norders 表状态分布:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    cursor.execute("SELECT status, COUNT(*) as cnt FROM transactions GROUP BY status")
    print("\ntransactions 表状态分布:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} 条")
    
    conn.close()
    return db_path


if __name__ == '__main__':
    create_test_database()
