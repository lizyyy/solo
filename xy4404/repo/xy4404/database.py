import sqlite3
import os
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from config import Config

class Database:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or Config.SQLITE_DB_PATH
        self._init_db()
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS performances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performance_name TEXT NOT NULL UNIQUE,
                    performance_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_public INTEGER DEFAULT 0,
                    needs_takedown INTEGER DEFAULT 0,
                    notes TEXT,
                    status TEXT DEFAULT 'incomplete'
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS audio_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performance_id INTEGER,
                    file_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    duration_seconds INTEGER,
                    format TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (performance_id) REFERENCES performances(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transcripts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performance_id INTEGER,
                    file_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    page_count INTEGER,
                    format TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (performance_id) REFERENCES performances(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS licenses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performance_id INTEGER,
                    file_name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size INTEGER,
                    license_type TEXT,
                    start_date DATE,
                    end_date DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (performance_id) REFERENCES performances(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    performance_id INTEGER,
                    issue_type TEXT NOT NULL,
                    issue_description TEXT NOT NULL,
                    file_name TEXT,
                    severity TEXT DEFAULT 'warning',
                    resolved INTEGER DEFAULT 0,
                    resolved_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (performance_id) REFERENCES performances(id)
                )
            ''')
            
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_performances_name ON performances(performance_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_audio_performance ON audio_files(performance_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_transcripts_performance ON transcripts(performance_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_licenses_performance ON licenses(performance_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_performance ON issues(performance_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved)')
            
            conn.commit()
    
    def get_or_create_performance(self, performance_name: str) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT id FROM performances WHERE performance_name = ?', (performance_name,))
            row = cursor.fetchone()
            
            if row:
                return row['id']
            
            cursor.execute(
                'INSERT INTO performances (performance_name, status) VALUES (?, ?)',
                (performance_name, 'incomplete')
            )
            conn.commit()
            return cursor.lastrowid
    
    def add_audio_file(self, performance_id: int, file_name: str, file_path: str, 
                       file_size: int = None, duration_seconds: int = None, format: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO audio_files (performance_id, file_name, file_path, file_size, duration_seconds, format)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (performance_id, file_name, file_path, file_size, duration_seconds, format))
            conn.commit()
            self._update_performance_status(conn, performance_id)
            return cursor.lastrowid
    
    def add_transcript(self, performance_id: int, file_name: str, file_path: str,
                       file_size: int = None, page_count: int = None, format: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO transcripts (performance_id, file_name, file_path, file_size, page_count, format)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (performance_id, file_name, file_path, file_size, page_count, format))
            conn.commit()
            self._update_performance_status(conn, performance_id)
            return cursor.lastrowid
    
    def add_license(self, performance_id: int, file_name: str, file_path: str,
                    file_size: int = None, license_type: str = None,
                    start_date: date = None, end_date: date = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO licenses (performance_id, file_name, file_path, file_size, license_type, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (performance_id, file_name, file_path, file_size, license_type,
                  start_date.isoformat() if start_date else None,
                  end_date.isoformat() if end_date else None))
            conn.commit()
            self._update_performance_status(conn, performance_id)
            return cursor.lastrowid
    
    def _update_performance_status(self, conn, performance_id: int):
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as cnt FROM audio_files WHERE performance_id = ?', (performance_id,))
        has_audio = cursor.fetchone()['cnt'] > 0
        
        cursor.execute('SELECT COUNT(*) as cnt FROM transcripts WHERE performance_id = ?', (performance_id,))
        has_transcript = cursor.fetchone()['cnt'] > 0
        
        cursor.execute('SELECT COUNT(*) as cnt FROM licenses WHERE performance_id = ?', (performance_id,))
        has_license = cursor.fetchone()['cnt'] > 0
        
        if has_audio and has_transcript and has_license:
            status = 'complete'
        elif has_audio or has_transcript or has_license:
            status = 'partial'
        else:
            status = 'incomplete'
        
        cursor.execute('UPDATE performances SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                       (status, performance_id))
        conn.commit()
    
    def add_issue(self, performance_id: int, issue_type: str, issue_description: str,
                  file_name: str = None, severity: str = 'warning'):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO issues (performance_id, issue_type, issue_description, file_name, severity)
                VALUES (?, ?, ?, ?, ?)
            ''', (performance_id, issue_type, issue_description, file_name, severity))
            conn.commit()
            return cursor.lastrowid
    
    def resolve_issue(self, issue_id: int):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues SET resolved = 1, resolved_at = CURRENT_TIMESTAMP WHERE id = ?
            ''', (issue_id,))
            conn.commit()
    
    def get_performance_by_name(self, performance_name: str) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM performances WHERE performance_name = ?', (performance_name,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_performance_by_id(self, performance_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM performances WHERE id = ?', (performance_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_all_performances(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM performances ORDER BY created_at DESC')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_performance_files(self, performance_id: int) -> Dict[str, List[Dict[str, Any]]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM audio_files WHERE performance_id = ?', (performance_id,))
            audio = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute('SELECT * FROM transcripts WHERE performance_id = ?', (performance_id,))
            transcripts = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute('SELECT * FROM licenses WHERE performance_id = ?', (performance_id,))
            licenses = [dict(row) for row in cursor.fetchall()]
            
            return {
                'audio': audio,
                'transcripts': transcripts,
                'licenses': licenses
            }
    
    def get_open_issues(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT i.*, p.performance_name 
                FROM issues i 
                JOIN performances p ON i.performance_id = p.id
                WHERE i.resolved = 0
                ORDER BY i.created_at DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_expiring_licenses(self, warning_days: int = None) -> List[Dict[str, Any]]:
        warning_days = warning_days or Config.LICENSE_EXPIRY_WARNING_DAYS
        today = date.today().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT l.*, p.performance_name, p.is_public, p.needs_takedown
                FROM licenses l
                JOIN performances p ON l.performance_id = p.id
                WHERE l.end_date IS NOT NULL 
                AND date(l.end_date) >= date(?)
                AND date(l.end_date) <= date(?, '+' || ? || ' days')
                ORDER BY l.end_date ASC
            ''', (today, today, warning_days))
            return [dict(row) for row in cursor.fetchall()]
    
    def update_performance_info(self, performance_id: int, **kwargs):
        allowed_fields = ['performance_date', 'is_public', 'needs_takedown', 'notes', 'status']
        update_fields = {k: v for k, v in kwargs.items() if k in allowed_fields}
        
        if not update_fields:
            return
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            set_clause = ', '.join([f'{k} = ?' for k in update_fields.keys()])
            values = list(update_fields.values())
            values.append(performance_id)
            
            cursor.execute(f'''
                UPDATE performances SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            ''', values)
            conn.commit()
    
    def check_duplicate_file(self, file_name: str, performance_id: int = None) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if performance_id:
                cursor.execute('''
                    SELECT 1 FROM audio_files WHERE file_name = ? AND performance_id = ?
                    UNION
                    SELECT 1 FROM transcripts WHERE file_name = ? AND performance_id = ?
                    UNION
                    SELECT 1 FROM licenses WHERE file_name = ? AND performance_id = ?
                ''', (file_name, performance_id, file_name, performance_id, file_name, performance_id))
            else:
                cursor.execute('''
                    SELECT 1 FROM audio_files WHERE file_name = ?
                    UNION
                    SELECT 1 FROM transcripts WHERE file_name = ?
                    UNION
                    SELECT 1 FROM licenses WHERE file_name = ?
                ''', (file_name, file_name, file_name))
            
            return cursor.fetchone() is not None
    
    def get_performances_with_missing_files(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.*,
                       (SELECT COUNT(*) FROM audio_files WHERE performance_id = p.id) as audio_count,
                       (SELECT COUNT(*) FROM transcripts WHERE performance_id = p.id) as transcript_count,
                       (SELECT COUNT(*) FROM licenses WHERE performance_id = p.id) as license_count
                FROM performances p
                WHERE (SELECT COUNT(*) FROM audio_files WHERE performance_id = p.id) = 0
                   OR (SELECT COUNT(*) FROM transcripts WHERE performance_id = p.id) = 0
                   OR (SELECT COUNT(*) FROM licenses WHERE performance_id = p.id) = 0
                ORDER BY p.created_at DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
