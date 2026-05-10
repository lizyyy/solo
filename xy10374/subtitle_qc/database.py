import sqlite3
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime
import json
from .config import get_db_path, ensure_directories


class Database:
    def __init__(self, db_path: str = None):
        ensure_directories()
        self.db_path = db_path or get_db_path()
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS subtitle_files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT UNIQUE NOT NULL,
                    file_hash TEXT NOT NULL,
                    last_scanned_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS issues (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subtitle_file_id INTEGER NOT NULL,
                    issue_type TEXT NOT NULL,
                    subtitle_index INTEGER,
                    start_time TEXT,
                    end_time TEXT,
                    original_text TEXT,
                    expected_text TEXT,
                    description TEXT,
                    suggestion TEXT,
                    status TEXT DEFAULT 'open',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP,
                    resolved_by TEXT,
                    FOREIGN KEY (subtitle_file_id) REFERENCES subtitle_files (id),
                    UNIQUE(subtitle_file_id, issue_type, subtitle_index, description)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS glossary_terms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    term TEXT NOT NULL,
                    canonical_form TEXT NOT NULL,
                    synonyms TEXT,
                    case_sensitive BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_issues_subtitle_file ON issues(subtitle_file_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_subtitle_files_path ON subtitle_files(file_path)
            ''')

    def save_subtitle_file(self, file_path: str, file_hash: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO subtitle_files (file_path, file_hash, last_scanned_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ''', (file_path, file_hash))
            return cursor.lastrowid or cursor.execute('SELECT id FROM subtitle_files WHERE file_path = ?', (file_path,)).fetchone()[0]

    def get_subtitle_file(self, file_path: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            return cursor.execute('SELECT * FROM subtitle_files WHERE file_path = ?', (file_path,)).fetchone()

    def save_issue(self, subtitle_file_id: int, issue_data: dict):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            keys = ['subtitle_file_id', 'issue_type', 'subtitle_index', 'start_time', 
                    'end_time', 'original_text', 'expected_text', 'description', 'suggestion']
            values = [subtitle_file_id] + [issue_data.get(k) for k in keys[1:]]
            
            existing = cursor.execute('''
                SELECT id, status FROM issues 
                WHERE subtitle_file_id = ? AND issue_type = ? AND subtitle_index = ? AND description = ?
            ''', (subtitle_file_id, issue_data['issue_type'], issue_data.get('subtitle_index'), issue_data.get('description'))).fetchone()
            
            if existing:
                if existing['status'] == 'resolved':
                    return None
                cursor.execute('''
                    UPDATE issues SET 
                        start_time = ?, end_time = ?, original_text = ?, expected_text = ?, 
                        suggestion = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (issue_data.get('start_time'), issue_data.get('end_time'), 
                      issue_data.get('original_text'), issue_data.get('expected_text'),
                      issue_data.get('suggestion'), existing['id']))
                return existing['id']
            else:
                placeholders = ', '.join(['?'] * len(keys))
                cursor.execute(f'''
                    INSERT INTO issues ({', '.join(keys)})
                    VALUES ({placeholders})
                ''', values)
                return cursor.lastrowid

    def get_issues(self, file_path: str = None, status: str = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT i.*, sf.file_path 
                FROM issues i
                JOIN subtitle_files sf ON i.subtitle_file_id = sf.id
                WHERE 1=1
            '''
            params = []
            if file_path:
                query += ' AND sf.file_path = ?'
                params.append(file_path)
            if status:
                query += ' AND i.status = ?'
                params.append(status)
            query += ' ORDER BY sf.file_path, i.subtitle_index'
            return cursor.execute(query, params).fetchall()

    def mark_issue_resolved(self, issue_id: int, resolved_by: str = 'system'):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues SET 
                    status = 'resolved',
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (resolved_by, issue_id))
            return cursor.rowcount > 0

    def mark_issue_open(self, issue_id: int):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE issues SET 
                    status = 'open',
                    resolved_at = NULL,
                    resolved_by = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (issue_id,))
            return cursor.rowcount > 0

    def save_glossary_term(self, term: str, canonical_form: str, synonyms: list = None, case_sensitive: bool = False):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO glossary_terms (term, canonical_form, synonyms, case_sensitive)
                VALUES (?, ?, ?, ?)
            ''', (term, canonical_form, json.dumps(synonyms or []) if synonyms else None, case_sensitive))
            return cursor.lastrowid

    def get_glossary_terms(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            rows = cursor.execute('SELECT * FROM glossary_terms').fetchall()
            terms = []
            for row in rows:
                term = dict(row)
                if term['synonyms']:
                    term['synonyms'] = json.loads(term['synonyms'])
                terms.append(term)
            return terms

    def clear_old_issues(self, subtitle_file_id: int, current_issue_hashes: set):
        pass
