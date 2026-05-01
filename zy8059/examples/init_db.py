import sqlite3
from pathlib import Path


def init_sample_db(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT,
            email TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            product TEXT,
            amount REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("INSERT INTO users (name, email) VALUES (?, ?)", ["管理员", "admin@example.com"])
    
    conn.commit()
    conn.close()
    print(f"示例数据库已创建: {db_path}")


if __name__ == '__main__':
    db_path = Path(__file__).parent / 'business.db'
    init_sample_db(db_path)
