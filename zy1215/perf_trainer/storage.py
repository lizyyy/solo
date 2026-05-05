import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from perf_trainer.config import Config
from perf_trainer.exceptions import DatabaseError, SessionNotFoundError


class Database:
    def __init__(self, db_path: Optional[Path] = None):
        if db_path is None:
            db_path = Config.get_db_path()
        self.db_path = db_path
        self._initialize_db()
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        except sqlite3.Error as e:
            raise DatabaseError(f"Database operation failed: {e}") from e
        finally:
            conn.close()
    
    def _initialize_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 创建演练会话表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_path TEXT NOT NULL,
                    incident_name TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    status TEXT NOT NULL DEFAULT 'in_progress',
                    notes TEXT
                )
            ''')
            
            # 创建排障步骤表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS steps (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    stage TEXT NOT NULL,
                    command TEXT NOT NULL,
                    user_choice TEXT,
                    is_correct BOOLEAN,
                    feedback TEXT,
                    sample_viewed TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES sessions (id)
                )
            ''')
            
            # 创建对比记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS comparisons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session1_id INTEGER NOT NULL,
                    session2_id INTEGER NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    result TEXT NOT NULL,
                    FOREIGN KEY (session1_id) REFERENCES sessions (id),
                    FOREIGN KEY (session2_id) REFERENCES sessions (id)
                )
            ''')
            
            conn.commit()
    
    # 会话相关操作
    def create_session(self, incident_path: str, incident_name: str = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO sessions (incident_path, incident_name, status)
                   VALUES (?, ?, ?)''',
                (incident_path, incident_name, 'in_progress')
            )
            conn.commit()
            return cursor.lastrowid
    
    def get_session(self, session_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM sessions WHERE id = ?',
                (session_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    def update_session_status(self, session_id: int, status: str, notes: str = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            if status == 'completed':
                cursor.execute(
                    '''UPDATE sessions 
                       SET status = ?, completed_at = CURRENT_TIMESTAMP, notes = ?
                       WHERE id = ?''',
                    (status, notes, session_id)
                )
            else:
                cursor.execute(
                    'UPDATE sessions SET status = ?, notes = ? WHERE id = ?',
                    (status, notes, session_id)
                )
            conn.commit()
    
    def list_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''SELECT * FROM sessions 
                   ORDER BY created_at DESC 
                   LIMIT ?''',
                (limit,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    # 步骤相关操作
    def add_step(self, session_id: int, stage: str, command: str, 
                 user_choice: str = None, is_correct: bool = None,
                 feedback: str = None, sample_viewed: str = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO steps 
                   (session_id, stage, command, user_choice, is_correct, feedback, sample_viewed)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (session_id, stage, command, user_choice, is_correct, feedback, sample_viewed)
            )
            conn.commit()
            return cursor.lastrowid
    
    def get_session_steps(self, session_id: int) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''SELECT * FROM steps 
                   WHERE session_id = ? 
                   ORDER BY created_at ASC''',
                (session_id,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    # 对比相关操作
    def save_comparison(self, session1_id: int, session2_id: int, result: str) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''INSERT INTO comparisons (session1_id, session2_id, result)
                   VALUES (?, ?, ?)''',
                (session1_id, session2_id, result)
            )
            conn.commit()
            return cursor.lastrowid
    
    def get_comparisons(self, limit: int = 10) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                '''SELECT * FROM comparisons 
                   ORDER BY created_at DESC 
                   LIMIT ?''',
                (limit,)
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
