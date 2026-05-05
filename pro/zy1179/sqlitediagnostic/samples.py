"""样例数据生成器"""

import os
import sqlite3
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any


class SampleGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def generate_normal_sample(self):
        normal_dir = os.path.join(self.output_dir, "normal")
        os.makedirs(normal_dir, exist_ok=True)
        
        self._create_normal_database(os.path.join(normal_dir, "app.db"))
        self._generate_normal_trace_log(os.path.join(normal_dir, "sqlite-trace.log"))
        self._generate_normal_migrations(os.path.join(normal_dir, "migrations"))
        self._generate_normal_pragma(os.path.join(normal_dir, "pragma.conf"))
        self._generate_normal_workload(os.path.join(normal_dir, "workload.log"))
    
    def generate_bad_samples(self):
        bad_dir = os.path.join(self.output_dir, "bad")
        os.makedirs(bad_dir, exist_ok=True)
        
        self._generate_long_read_sample(bad_dir)
        self._generate_lock_contention_sample(bad_dir)
        self._generate_wal_growth_sample(bad_dir)
        self._generate_migration_risk_sample(bad_dir)
    
    def _create_normal_database(self, db_path: str):
        if os.path.exists(db_path):
            os.remove(db_path)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous = NORMAL")
        cursor.execute("PRAGMA busy_timeout = 5000")
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA wal_autocheckpoint = 1000")
        
        cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        cursor.execute("CREATE INDEX idx_orders_user_id ON orders(user_id)")
        cursor.execute("CREATE INDEX idx_users_email ON users(email)")
        
        for i in range(100):
            cursor.execute(
                "INSERT INTO users (name, email) VALUES (?, ?)",
                (f"User {i}", f"user{i}@example.com")
            )
        
        for i in range(500):
            cursor.execute(
                "INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)",
                (random.randint(1, 100), random.uniform(10.0, 1000.0), 
                 random.choice(['pending', 'paid', 'shipped', 'delivered']))
            )
        
        conn.commit()
        conn.close()
        
        wal_path = db_path + "-wal"
        if os.path.exists(wal_path):
            os.remove(wal_path)
    
    def _generate_normal_trace_log(self, log_path: str):
        lines = []
        base_time = datetime.now() - timedelta(hours=1)
        
        for i in range(100):
            timestamp = base_time + timedelta(seconds=i * 2)
            
            if i % 5 == 0:
                lines.append(
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{i % 5 + 1}] BEGIN TRANSACTION"
                )
            
            op_type = random.choice(["SELECT", "INSERT", "UPDATE", "SELECT", "SELECT"])
            duration = random.uniform(1, 50)
            
            if op_type == "SELECT":
                stmt = "SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE u.id = ?"
            elif op_type == "INSERT":
                stmt = "INSERT INTO orders (user_id, total_amount) VALUES (?, ?)"
            else:
                stmt = "UPDATE orders SET status = ? WHERE id = ?"
            
            lines.append(
                f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{i % 5 + 1}] {op_type} - {duration:.2f}ms - {stmt}"
            )
            
            if (i + 1) % 5 == 0:
                commit_time = timestamp + timedelta(milliseconds=duration)
                lines.append(
                    f"{commit_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{i % 5 + 1}] COMMIT - 0.5ms"
                )
        
        with open(log_path, 'w') as f:
            f.write("\n".join(lines))
    
    def _generate_normal_migrations(self, migrations_dir: str):
        os.makedirs(migrations_dir, exist_ok=True)
        
        migrations = [
            ("001_initial.up.sql", """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""),
            ("002_add_indexes.up.sql", """
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE UNIQUE INDEX idx_users_email ON users(email);
"""),
            ("003_add_foreign_key.up.sql", """
-- 注意：SQLite 不支持 ALTER TABLE ADD CONSTRAINT
-- 这是一个安全的迁移示例
PRAGMA foreign_keys = ON;
"""),
        ]
        
        for filename, content in migrations:
            with open(os.path.join(migrations_dir, filename), 'w') as f:
                f.write(content.strip())
    
    def _generate_normal_pragma(self, config_path: str):
        config = """
-- 推荐的生产环境配置
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
PRAGMA wal_autocheckpoint = 1000;
PRAGMA cache_size = -2000;
PRAGMA temp_store = MEMORY;
""".strip()
        
        with open(config_path, 'w') as f:
            f.write(config)
    
    def _generate_normal_workload(self, log_path: str):
        lines = []
        base_time = datetime.now() - timedelta(hours=2)
        
        for txn_id in range(50):
            txn_start = base_time + timedelta(seconds=txn_id * 10)
            conn_id = txn_id % 5 + 1
            
            lines.append(
                f"{txn_start.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] BEGIN"
            )
            
            num_ops = random.randint(2, 5)
            for op_num in range(num_ops):
                op_time = txn_start + timedelta(milliseconds=op_num * 50)
                is_read = random.random() < 0.7
                
                if is_read:
                    op_type = "SELECT"
                    table = random.choice(["users", "orders"])
                    duration = random.uniform(1, 30)
                    rows = random.randint(1, 100)
                else:
                    op_type = random.choice(["INSERT", "UPDATE"])
                    table = random.choice(["orders", "users"])
                    duration = random.uniform(5, 50)
                    rows = 1
                
                lines.append(
                    f"{op_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] {op_type} {table} - {duration:.2f}ms - {rows} rows affected"
                )
            
            commit_time = txn_start + timedelta(milliseconds=num_ops * 50 + 10)
            lines.append(
                f"{commit_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] COMMIT - 2.5ms"
            )
        
        with open(log_path, 'w') as f:
            f.write("\n".join(lines))
    
    def _generate_long_read_sample(self, base_dir: str):
        sample_dir = os.path.join(base_dir, "long-read-transactions")
        os.makedirs(sample_dir, exist_ok=True)
        
        log_path = os.path.join(sample_dir, "workload.log")
        lines = []
        base_time = datetime.now() - timedelta(hours=1)
        
        for txn_id in range(5):
            txn_start = base_time + timedelta(seconds=txn_id * 30)
            conn_id = txn_id + 1
            
            lines.append(
                f"{txn_start.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] BEGIN"
            )
            
            num_ops = random.randint(5, 15)
            for op_num in range(num_ops):
                op_time = txn_start + timedelta(seconds=op_num * 2)
                duration = random.uniform(1000, 5000)
                rows = random.randint(1000, 10000)
                
                lines.append(
                    f"{op_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] SELECT orders - {duration:.2f}ms - {rows} rows affected"
                )
            
            commit_time = txn_start + timedelta(seconds=num_ops * 2 + 1)
            lines.append(
                f"{commit_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{conn_id}] [txn:{txn_id}] COMMIT - {random.uniform(5, 20):.2f}ms"
            )
        
        with open(log_path, 'w') as f:
            f.write("\n".join(lines))
        
        trace_path = os.path.join(sample_dir, "sqlite-trace.log")
        trace_lines = []
        for i in range(10):
            timestamp = base_time + timedelta(seconds=i * 60)
            duration = random.uniform(10000, 60000)
            trace_lines.append(
                f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:{i % 3 + 1}] SELECT - {duration:.2f}ms - SELECT * FROM orders WHERE status = 'pending'"
            )
        
        with open(trace_path, 'w') as f:
            f.write("\n".join(trace_lines))
    
    def _generate_lock_contention_sample(self, base_dir: str):
        sample_dir = os.path.join(base_dir, "lock-contention")
        os.makedirs(sample_dir, exist_ok=True)
        
        log_path = os.path.join(sample_dir, "sqlite-trace.log")
        lines = []
        base_time = datetime.now() - timedelta(minutes=30)
        
        for i in range(50):
            timestamp = base_time + timedelta(milliseconds=i * 100)
            
            if i % 3 == 0:
                lines.append(
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:1] [txn:100] BEGIN EXCLUSIVE"
                )
            
            if i % 2 == 0:
                lines.append(
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:2] [txn:101] INSERT orders - lock wait: 500ms - database is locked"
                )
            
            if i % 5 == 4:
                lines.append(
                    f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:3] [txn:102] BUSY - database is locked (code 5)"
                )
            
            duration = random.uniform(10, 100)
            lines.append(
                f"{timestamp.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]} [conn:1] [txn:100] UPDATE orders - {duration:.2f}ms - 1 row affected"
            )
        
        with open(log_path, 'w') as f:
            f.write("\n".join(lines))
    
    def _generate_wal_growth_sample(self, base_dir: str):
        sample_dir = os.path.join(base_dir, "wal-growth")
        os.makedirs(sample_dir, exist_ok=True)
        
        db_path = os.path.join(sample_dir, "app.db")
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA wal_autocheckpoint = 100")
        cursor.execute("PRAGMA busy_timeout = 1000")
        
        cursor.execute("""
            CREATE TABLE logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        for i in range(10000):
            cursor.execute(
                "INSERT INTO logs (message) VALUES (?)",
                (f"Log message {i}",)
            )
        
        conn.commit()
        
        wal_path = db_path + "-wal"
        
        pragma_path = os.path.join(sample_dir, "pragma.conf")
        with open(pragma_path, 'w') as f:
            f.write("""
PRAGMA journal_mode = WAL;
PRAGMA wal_autocheckpoint = 100;
PRAGMA busy_timeout = 1000;
PRAGMA synchronous = FULL;
""".strip())
        
        conn.close()
    
    def _generate_migration_risk_sample(self, base_dir: str):
        sample_dir = os.path.join(base_dir, "migration-risks")
        os.makedirs(sample_dir, exist_ok=True)
        
        migrations_dir = os.path.join(sample_dir, "migrations")
        os.makedirs(migrations_dir, exist_ok=True)
        
        risky_migrations = [
            ("001_rebuild_table.up.sql", """
-- 危险：使用 CREATE TABLE ... AS SELECT 重建表
-- 这会锁定表很长时间

BEGIN TRANSACTION;

CREATE TABLE users_new AS 
SELECT 
    id,
    name,
    email,
    created_at,
    'default' as status
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_email ON users(email);

COMMIT;
"""),
            ("002_alter_column.up.sql", """
-- 危险：在 SQLite 中修改列类型需要表重建
-- 注意：SQLite 的 ALTER TABLE 有很多限制

BEGIN TRANSACTION;

PRAGMA foreign_keys = OFF;

CREATE TABLE orders_new (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,  -- 改变类型
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO orders_new SELECT * FROM orders;

DROP TABLE orders;

ALTER TABLE orders_new RENAME TO orders;

PRAGMA foreign_keys = ON;

COMMIT;
"""),
            ("003_drop_table.up.sql", """
-- 危险：DROP TABLE 是高风险操作

BEGIN TRANSACTION;

DROP TABLE IF EXISTS old_logs;
DROP TABLE IF EXISTS temp_data;

COMMIT;
"""),
        ]
        
        for filename, content in risky_migrations:
            with open(os.path.join(migrations_dir, filename), 'w') as f:
                f.write(content.strip())
