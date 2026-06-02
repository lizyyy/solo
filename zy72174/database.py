import os
import sqlite3

DATABASE = 'resettlement.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_no TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        district TEXT,
        gis_lng REAL,
        gis_lat REAL,
        property_type TEXT,
        area REAL,
        households INTEGER,
        status TEXT DEFAULT 'pending',
        current_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_file TEXT,
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        imported_by TEXT DEFAULT 'system'
    );

    CREATE TABLE IF NOT EXISTS point_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT NOT NULL,
        source_id INTEGER,
        operator TEXT DEFAULT 'system',
        operation_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points(id),
        FOREIGN KEY (source_id) REFERENCES data_sources(id)
    );

    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        feedback_type TEXT,
        feedback_content TEXT NOT NULL,
        feedback_source TEXT,
        feedback_time DATETIME,
        handler TEXT,
        handle_note TEXT,
        handled_at DATETIME,
        is_resolved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        photo_path TEXT,
        photo_desc TEXT,
        taken_at DATETIME,
        taken_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points(id)
    );

    CREATE TABLE IF NOT EXISTS manual_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        street_name TEXT,
        note_content TEXT,
        operator TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points(id)
    );

    CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point_id INTEGER NOT NULL,
        reviewer TEXT,
        review_result TEXT NOT NULL,
        review_note TEXT,
        review_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (point_id) REFERENCES points(id)
    );

    CREATE INDEX IF NOT EXISTS idx_points_status ON points(status);
    CREATE INDEX IF NOT EXISTS idx_point_versions_point ON point_versions(point_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_point ON feedback(point_id);
    CREATE INDEX IF NOT EXISTS idx_photos_point ON inspection_photos(point_id);
    ''')
    
    conn.commit()
    conn.close()
