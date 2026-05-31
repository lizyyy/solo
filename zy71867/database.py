import sqlite3
import hashlib
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'teaching_research.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS lectures (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        screenshot_path TEXT,
        screenshot_hash TEXT,
        difficulty_tag TEXT,
        difficulty_confirmed INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        version INTEGER DEFAULT 1
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS commentary_records (
        id TEXT PRIMARY KEY,
        lecture_id TEXT NOT NULL,
        content TEXT NOT NULL,
        teacher TEXT,
        recorded_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        FOREIGN KEY (lecture_id) REFERENCES lectures(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS tangent_checks (
        id TEXT PRIMARY KEY,
        lecture_id TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        result TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        next_step TEXT NOT NULL,
        confidence REAL NOT NULL,
        checker TEXT DEFAULT 'system',
        manual_confirm INTEGER DEFAULT 0,
        confirmed_by TEXT,
        confirmed_at TEXT,
        FOREIGN KEY (lecture_id) REFERENCES lectures(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        lecture_id TEXT,
        record_type TEXT,
        record_id TEXT,
        old_value TEXT,
        new_value TEXT,
        operator TEXT,
        operated_at TEXT NOT NULL,
        ip_address TEXT,
        note TEXT
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS duplicate_records (
        id TEXT PRIMARY KEY,
        lecture_id TEXT NOT NULL,
        duplicate_type TEXT NOT NULL,
        duplicate_key TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        resolved_at TEXT,
        resolution TEXT,
        FOREIGN KEY (lecture_id) REFERENCES lectures(id)
    )''')
    
    conn.commit()
    conn.close()

def generate_id(prefix=''):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
    random_part = hashlib.md5(os.urandom(16)).hexdigest()[:8]
    return f"{prefix}{timestamp}{random_part}"

def calculate_hash(content):
    if isinstance(content, str):
        content = content.encode('utf-8')
    return hashlib.sha256(content).hexdigest()

def file_hash(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()
