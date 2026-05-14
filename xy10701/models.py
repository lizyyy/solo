import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

DATABASE = 'openapi_review.db'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS specs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL,
            spec_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            old_spec_id INTEGER NOT NULL,
            new_spec_id INTEGER NOT NULL,
            status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (old_spec_id) REFERENCES specs (id),
            FOREIGN KEY (new_spec_id) REFERENCES specs (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL,
            change_type TEXT NOT NULL,
            path TEXT NOT NULL,
            method TEXT,
            field TEXT,
            description TEXT NOT NULL,
            is_breaking BOOLEAN DEFAULT 0,
            severity TEXT DEFAULT 'medium',
            FOREIGN KEY (review_id) REFERENCES reviews (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS approvals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL,
            approver TEXT NOT NULL,
            approved BOOLEAN NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (review_id) REFERENCES reviews (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timelines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            review_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            description TEXT NOT NULL,
            actor TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            FOREIGN KEY (review_id) REFERENCES reviews (id)
        )
    ''')
    
    conn.commit()
    conn.close()

class Spec:
    @staticmethod
    def create(version: str, spec: Dict[str, Any]) -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO specs (version, spec_json) VALUES (?, ?)',
            (version, json.dumps(spec))
        )
        spec_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return spec_id
    
    @staticmethod
    def get(spec_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM specs WHERE id = ?', (spec_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                'id': row['id'],
                'version': row['version'],
                'spec': json.loads(row['spec_json']),
                'created_at': row['created_at']
            }
        return None
    
    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM specs ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [{
            'id': row['id'],
            'version': row['version'],
            'created_at': row['created_at']
        } for row in rows]

class Review:
    @staticmethod
    def create(old_spec_id: int, new_spec_id: int, status: str = 'PENDING') -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO reviews (old_spec_id, new_spec_id, status) VALUES (?, ?, ?)',
            (old_spec_id, new_spec_id, status)
        )
        review_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return review_id
    
    @staticmethod
    def get(review_id: int) -> Optional[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reviews WHERE id = ?', (review_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None
    
    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reviews ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def update_status(review_id: int, status: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE reviews SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (status, review_id)
        )
        conn.commit()
        conn.close()

class Change:
    @staticmethod
    def create(review_id: int, change_type: str, path: str, method: str, 
               field: str, description: str, is_breaking: bool, severity: str) -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO changes (review_id, change_type, path, method, field, 
               description, is_breaking, severity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (review_id, change_type, path, method, field, description, is_breaking, severity)
        )
        change_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return change_id
    
    @staticmethod
    def get_by_review(review_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM changes WHERE review_id = ? ORDER BY is_breaking DESC', (review_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

class Approval:
    @staticmethod
    def create(review_id: int, approver: str, approved: bool, reason: str) -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO approvals (review_id, approver, approved, reason) VALUES (?, ?, ?, ?)',
            (review_id, approver, approved, reason)
        )
        approval_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return approval_id
    
    @staticmethod
    def get_by_review(review_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM approvals WHERE review_id = ? ORDER BY created_at DESC', (review_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

class Timeline:
    @staticmethod
    def create(review_id: int, event_type: str, description: str, 
               actor: str = None, metadata: Dict = None) -> int:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO timelines (review_id, event_type, description, actor, metadata) VALUES (?, ?, ?, ?, ?)',
            (review_id, event_type, description, actor, json.dumps(metadata) if metadata else None)
        )
        timeline_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return timeline_id
    
    @staticmethod
    def get_by_review(review_id: int) -> List[Dict[str, Any]]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM timelines WHERE review_id = ? ORDER BY created_at ASC', (review_id,))
        rows = cursor.fetchall()
        conn.close()
        return [{
            'id': row['id'],
            'review_id': row['review_id'],
            'event_type': row['event_type'],
            'description': row['description'],
            'actor': row['actor'],
            'created_at': row['created_at'],
            'metadata': json.loads(row['metadata']) if row['metadata'] else None
        } for row in rows]

def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as total FROM reviews')
    total_reviews = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as count FROM reviews WHERE status = "BLOCKED"')
    blocked = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM reviews WHERE status = "APPROVED"')
    approved = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM reviews WHERE status = "REJECTED"')
    rejected = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM changes WHERE is_breaking = 1')
    breaking_changes = cursor.fetchone()['count']
    
    conn.close()
    
    return {
        'total_reviews': total_reviews,
        'blocked': blocked,
        'approved': approved,
        'rejected': rejected,
        'breaking_changes': breaking_changes,
        'pending': total_reviews - blocked - approved - rejected
    }
