import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
import json


DATABASE_PATH = "anchor_migration.db"


@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS markdown_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_hash TEXT,
                last_scanned_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS heading_anchors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                heading_text TEXT NOT NULL,
                heading_level INTEGER NOT NULL,
                anchor_slug TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                version INTEGER DEFAULT 1,
                is_current BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES markdown_files (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file_id INTEGER NOT NULL,
                link_text TEXT NOT NULL,
                old_link_url TEXT NOT NULL,
                old_anchor TEXT,
                new_link_url TEXT,
                new_anchor TEXT,
                line_number INTEGER NOT NULL,
                column_number INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                resolution_note TEXT,
                needs_review BOOLEAN DEFAULT 0,
                reviewed_by TEXT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_file_id) REFERENCES markdown_files (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS migration_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_name TEXT NOT NULL,
                total_files_scanned INTEGER DEFAULT 0,
                total_links_found INTEGER DEFAULT 0,
                broken_links_found INTEGER DEFAULT 0,
                auto_fixed_links INTEGER DEFAULT 0,
                needs_review_links INTEGER DEFAULT 0,
                report_data JSON,
                status TEXT DEFAULT 'generating',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_links_status ON links(status)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_links_file ON links(source_file_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_anchors_file ON heading_anchors(file_id)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_anchors_slug ON heading_anchors(anchor_slug)
        ''')
        
        conn.commit()


def insert_markdown_file(file_path: str, file_hash: str = None) -> int:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO markdown_files (file_path, file_hash, last_scanned_at, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ''', (file_path, file_hash))
        conn.commit()
        cursor.execute('SELECT id FROM markdown_files WHERE file_path = ?', (file_path,))
        return cursor.fetchone()['id']


def insert_heading_anchor(file_id: int, heading_text: str, heading_level: int, 
                          anchor_slug: str, line_number: int, version: int = 1):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE heading_anchors SET is_current = 0 
            WHERE file_id = ? AND anchor_slug = ?
        ''', (file_id, anchor_slug))
        cursor.execute('''
            INSERT INTO heading_anchors 
            (file_id, heading_text, heading_level, anchor_slug, line_number, version, is_current)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ''', (file_id, heading_text, heading_level, anchor_slug, line_number, version))
        conn.commit()
        return cursor.lastrowid


def insert_link(source_file_id: int, link_text: str, old_link_url: str, old_anchor: str,
                line_number: int, column_number: int) -> int:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO links 
            (source_file_id, link_text, old_link_url, old_anchor, line_number, column_number)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (source_file_id, link_text, old_link_url, old_anchor, line_number, column_number))
        conn.commit()
        return cursor.lastrowid


def update_link(link_id: int, **kwargs):
    allowed_fields = ['new_link_url', 'new_anchor', 'status', 'resolution_note', 
                      'needs_review', 'reviewed_by', 'reviewed_at']
    update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}
    if not update_fields:
        return
    
    update_fields['updated_at'] = datetime.now().isoformat()
    set_clause = ', '.join([f"{k} = ?" for k in update_fields.keys()])
    values = list(update_fields.values()) + [link_id]
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f'UPDATE links SET {set_clause} WHERE id = ?', values)
        conn.commit()


def get_link_by_id(link_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM links WHERE id = ?', (link_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_links_by_status(status: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM links WHERE status = ?', (status,))
        return [dict(row) for row in cursor.fetchall()]


def get_all_links() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM links ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]


def get_anchors_by_file_id(file_id: int) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM heading_anchors 
            WHERE file_id = ? AND is_current = 1
            ORDER BY line_number
        ''', (file_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_file_by_path(file_path: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM markdown_files WHERE file_path = ?', (file_path,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_all_files() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM markdown_files ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]


def create_report(report_name: str, report_data: Dict, **kwargs) -> int:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO migration_reports 
            (report_name, total_files_scanned, total_links_found, broken_links_found,
             auto_fixed_links, needs_review_links, report_data, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            report_name,
            kwargs.get('total_files_scanned', 0),
            kwargs.get('total_links_found', 0),
            kwargs.get('broken_links_found', 0),
            kwargs.get('auto_fixed_links', 0),
            kwargs.get('needs_review_links', 0),
            json.dumps(report_data),
            'completed'
        ))
        conn.commit()
        return cursor.lastrowid


def get_report(report_id: int) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM migration_reports WHERE id = ?', (report_id,))
        row = cursor.fetchone()
        if row:
            result = dict(row)
            result['report_data'] = json.loads(result['report_data'])
            return result
        return None


def get_all_reports() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM migration_reports ORDER BY created_at DESC')
        results = []
        for row in cursor.fetchall():
            result = dict(row)
            result['report_data'] = json.loads(result['report_data'])
            results.append(result)
        return results
