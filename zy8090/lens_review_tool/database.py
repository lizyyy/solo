import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "reviews.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            review_time TEXT NOT NULL,
            notes TEXT,
            issues TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_review(order_id, status, review_time, notes, issues):
    conn = sqlite3.connect(DB_PATH)
    issues_json = ",".join(issues) if issues else ""
    conn.execute("""
        INSERT OR REPLACE INTO reviews (order_id, status, review_time, notes, issues)
        VALUES (?, ?, ?, ?, ?)
    """, (order_id, status, review_time, notes, issues_json))
    conn.commit()
    conn.close()

def load_review(order_id):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT status, review_time, notes, issues FROM reviews WHERE order_id = ?", (order_id,))
    row = cur.fetchone()
    conn.close()
    if row:
        return {"status": row[0], "review_time": row[1], "notes": row[2], "issues": row[3].split(",") if row[3] else []}
    return None

def load_all_reviews():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT order_id, status, review_time, notes, issues FROM reviews")
    rows = cur.fetchall()
    conn.close()
    return [{"order_id": r[0], "status": r[1], "review_time": r[2], "notes": r[3], "issues": r[4].split(",") if r[4] else []} for r in rows]

def clear_reviews():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM reviews")
    conn.commit()
    conn.close()