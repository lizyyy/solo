import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

from config import get_config


class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = get_config().db_path
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS members (
                    member_id TEXT PRIMARY KEY,
                    name TEXT,
                    phone TEXT,
                    email TEXT,
                    join_date TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT,
                    tag_name TEXT,
                    source TEXT,
                    source_display_name TEXT,
                    reason TEXT,
                    start_date TEXT,
                    end_date TEXT,
                    is_cleaned INTEGER DEFAULT 0,
                    cleaned_at TEXT,
                    cleaned_by TEXT,
                    cleaned_reason TEXT,
                    imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    import_batch_id TEXT,
                    FOREIGN KEY (member_id) REFERENCES members(member_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS conflicts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    member_id TEXT,
                    conflict_type TEXT,
                    tag_ids TEXT,
                    description TEXT,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    resolved_by TEXT,
                    resolution TEXT,
                    resolution_tags TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS import_batches (
                    id TEXT PRIMARY KEY,
                    source TEXT,
                    file_name TEXT,
                    imported_by TEXT,
                    imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    record_count INTEGER
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_tags_member ON tags(member_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_tags_source ON tags(source)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_conflicts_member ON conflicts(member_id)
            ''')
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON conflicts(resolved)
            ''')

    def import_member(self, member_data: Dict[str, Any]) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO members 
                (member_id, name, phone, email, join_date, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                member_data['member_id'],
                member_data.get('name'),
                member_data.get('phone'),
                member_data.get('email'),
                member_data.get('join_date'),
                datetime.now().isoformat()
            ))
            return True

    def import_tag(self, tag_data: Dict[str, Any], batch_id: str) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            existing = self._find_duplicate_tag(cursor, tag_data)
            if existing:
                return existing[0]
            
            cursor.execute('''
                INSERT INTO tags 
                (member_id, tag_name, source, source_display_name, reason, 
                 start_date, end_date, import_batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                tag_data['member_id'],
                tag_data['tag_name'],
                tag_data['source'],
                tag_data.get('source_display_name', tag_data['source']),
                tag_data.get('reason'),
                tag_data.get('start_date'),
                tag_data.get('end_date'),
                batch_id
            ))
            return cursor.lastrowid

    def _find_duplicate_tag(self, cursor, tag_data: Dict[str, Any]) -> Optional[tuple]:
        cursor.execute('''
            SELECT id FROM tags 
            WHERE member_id = ? AND tag_name = ? AND source = ? 
              AND start_date = ? AND is_cleaned = 0
        ''', (
            tag_data['member_id'],
            tag_data['tag_name'],
            tag_data['source'],
            tag_data.get('start_date')
        ))
        return cursor.fetchone()

    def create_batch(self, source: str, file_name: str, imported_by: str, 
                     record_count: int) -> str:
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d%H%M%S')}_{source}"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO import_batches 
                (id, source, file_name, imported_by, record_count)
                VALUES (?, ?, ?, ?, ?)
            ''', (batch_id, source, file_name, imported_by, record_count))
        return batch_id

    def get_member(self, member_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM members WHERE member_id = ?', (member_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_member_tags(self, member_id: str, include_cleaned: bool = False) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if include_cleaned:
                cursor.execute('SELECT * FROM tags WHERE member_id = ? ORDER BY imported_at', 
                             (member_id,))
            else:
                cursor.execute('SELECT * FROM tags WHERE member_id = ? AND is_cleaned = 0 ORDER BY imported_at', 
                             (member_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_all_members(self) -> List[str]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT member_id FROM members')
            return [row[0] for row in cursor.fetchall()]

    def save_conflict(self, member_id: str, conflict_type: str, tag_ids: List[int], 
                      description: str) -> int:
        tag_ids_str = ','.join(map(str, tag_ids))
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            existing = self._find_similar_conflict(cursor, member_id, conflict_type, tag_ids_str)
            if existing:
                return existing[0]
            
            cursor.execute('''
                INSERT INTO conflicts 
                (member_id, conflict_type, tag_ids, description)
                VALUES (?, ?, ?, ?)
            ''', (member_id, conflict_type, tag_ids_str, description))
            return cursor.lastrowid

    def _find_similar_conflict(self, cursor, member_id: str, conflict_type: str, 
                                tag_ids_str: str) -> Optional[tuple]:
        cursor.execute('''
            SELECT id FROM conflicts 
            WHERE member_id = ? AND conflict_type = ? AND tag_ids = ? AND resolved = 0
        ''', (member_id, conflict_type, tag_ids_str))
        return cursor.fetchone()

    def resolve_conflict(self, conflict_id: int, resolved_by: str, resolution: str,
                         cleaned_tag_ids: List[int], cleaned_reason: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            for tag_id in cleaned_tag_ids:
                cursor.execute('''
                    UPDATE tags 
                    SET is_cleaned = 1, cleaned_at = ?, cleaned_by = ?, cleaned_reason = ?
                    WHERE id = ?
                ''', (datetime.now().isoformat(), resolved_by, cleaned_reason, tag_id))
            
            resolution_tags = ','.join(map(str, cleaned_tag_ids))
            cursor.execute('''
                UPDATE conflicts 
                SET resolved = 1, resolved_at = ?, resolved_by = ?, 
                    resolution = ?, resolution_tags = ?
                WHERE id = ?
            ''', (datetime.now().isoformat(), resolved_by, resolution, resolution_tags, conflict_id))
            
            return True

    def get_conflicts(self, member_id: str = None, resolved: bool = False) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = 'SELECT * FROM conflicts WHERE resolved = ?'
            params = [1 if resolved else 0]
            
            if member_id:
                query += ' AND member_id = ?'
                params.append(member_id)
            
            query += ' ORDER BY created_at DESC'
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_conflict_history(self, member_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM conflicts 
                WHERE member_id = ? 
                ORDER BY created_at DESC
            ''', (member_id,))
            return [dict(row) for row in cursor.fetchall()]

    def get_resolution_history(self, member_id: str, tag_name: str = None, 
                                source: str = None) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT c.*, t.tag_name, t.source
                FROM conflicts c
                JOIN tags t ON ',' || c.tag_ids || ',' LIKE '%,' || t.id || ',%'
                WHERE c.member_id = ? AND c.resolved = 1
            '''
            params = [member_id]
            
            if tag_name:
                query += ' AND t.tag_name = ?'
                params.append(tag_name)
            if source:
                query += ' AND t.source = ?'
                params.append(source)
            
            query += ' ORDER BY c.resolved_at DESC'
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def check_reappearance(self, member_id: str, tag_name: str, source: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM tags 
                WHERE member_id = ? AND tag_name = ? AND source = ? AND is_cleaned = 1
                ORDER BY cleaned_at DESC
            ''', (member_id, tag_name, source))
            return [dict(row) for row in cursor.fetchall()]

    def get_tag_by_id(self, tag_id: int) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM tags WHERE id = ?', (tag_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def clear_conflicts(self, member_id: str = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if member_id:
                cursor.execute('DELETE FROM conflicts WHERE member_id = ? AND resolved = 0', 
                             (member_id,))
            else:
                cursor.execute('DELETE FROM conflicts WHERE resolved = 0')
