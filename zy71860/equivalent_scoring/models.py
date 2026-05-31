import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field, asdict
from .config import DB_PATH

@dataclass
class ErrorQuestion:
    id: Optional[int] = None
    question_id: str = ""
    question_text: str = ""
    standard_answer: str = ""
    student_answer: str = ""
    student_id: str = ""
    score: float = 0.0
    max_score: float = 1.0
    is_empty: bool = False
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class ScoringRecord:
    id: Optional[int] = None
    question_id: str = ""
    student_id: str = ""
    standard_answer: str = ""
    student_answer: str = ""
    similarity_score: float = 0.0
    is_equivalent: bool = False
    threshold: float = 0.85
    scoring_reason: str = ""
    is_controversial: bool = False
    controversial_reason: str = ""
    reviewer: Optional[str] = None
    reviewed: bool = False
    final_score: Optional[float] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    reviewed_at: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)

@dataclass
class ReviewHistory:
    id: Optional[int] = None
    record_id: int = 0
    reviewer: str = ""
    action: str = ""
    previous_equivalent: Optional[bool] = None
    new_equivalent: Optional[bool] = None
    previous_score: Optional[float] = None
    new_score: Optional[float] = None
    reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    def to_dict(self) -> Dict:
        return asdict(self)

class Database:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_db()
    
    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS error_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT,
                question_text TEXT,
                standard_answer TEXT,
                student_answer TEXT,
                student_id TEXT,
                score REAL,
                max_score REAL,
                is_empty BOOLEAN,
                created_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scoring_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT,
                student_id TEXT,
                standard_answer TEXT,
                student_answer TEXT,
                similarity_score REAL,
                is_equivalent BOOLEAN,
                threshold REAL,
                scoring_reason TEXT,
                is_controversial BOOLEAN,
                controversial_reason TEXT,
                reviewer TEXT,
                reviewed BOOLEAN,
                final_score REAL,
                created_at TEXT,
                reviewed_at TEXT
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS review_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER,
                reviewer TEXT,
                action TEXT,
                previous_equivalent BOOLEAN,
                new_equivalent BOOLEAN,
                previous_score REAL,
                new_score REAL,
                reason TEXT,
                created_at TEXT,
                FOREIGN KEY (record_id) REFERENCES scoring_records(id)
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_question ON scoring_records(question_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_student ON scoring_records(student_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_records_reviewed ON scoring_records(reviewed)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_history_record ON review_history(record_id)')
        
        conn.commit()
        conn.close()
    
    def _get_conn(self):
        return sqlite3.connect(self.db_path)
    
    def add_error_question(self, eq: ErrorQuestion) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO error_questions (question_id, question_text, standard_answer, 
                student_answer, student_id, score, max_score, is_empty, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (eq.question_id, eq.question_text, eq.standard_answer, eq.student_answer,
              eq.student_id, eq.score, eq.max_score, eq.is_empty, eq.created_at))
        eq.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return eq.id
    
    def add_scoring_record(self, sr: ScoringRecord) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO scoring_records (question_id, student_id, standard_answer, student_answer,
                similarity_score, is_equivalent, threshold, scoring_reason, is_controversial,
                controversial_reason, reviewer, reviewed, final_score, created_at, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (sr.question_id, sr.student_id, sr.standard_answer, sr.student_answer,
              sr.similarity_score, sr.is_equivalent, sr.threshold, sr.scoring_reason,
              sr.is_controversial, sr.controversial_reason, sr.reviewer, sr.reviewed,
              sr.final_score, sr.created_at, sr.reviewed_at))
        sr.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return sr.id
    
    def update_scoring_record(self, sr: ScoringRecord):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE scoring_records SET
                similarity_score=?, is_equivalent=?, threshold=?, scoring_reason=?,
                is_controversial=?, controversial_reason=?, reviewer=?, reviewed=?,
                final_score=?, reviewed_at=?
            WHERE id=?
        ''', (sr.similarity_score, sr.is_equivalent, sr.threshold, sr.scoring_reason,
              sr.is_controversial, sr.controversial_reason, sr.reviewer, sr.reviewed,
              sr.final_score, sr.reviewed_at, sr.id))
        conn.commit()
        conn.close()
    
    def get_scoring_record(self, record_id: int) -> Optional[ScoringRecord]:
        conn = self._get_conn()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM scoring_records WHERE id=?', (record_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return ScoringRecord(**dict(row))
        return None
    
    def get_scoring_records(self, question_id: str = None, student_id: str = None,
                           reviewed: bool = None, controversial: bool = None) -> List[ScoringRecord]:
        conn = self._get_conn()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = 'SELECT * FROM scoring_records WHERE 1=1'
        params = []
        
        if question_id:
            query += ' AND question_id=?'
            params.append(question_id)
        if student_id:
            query += ' AND student_id=?'
            params.append(student_id)
        if reviewed is not None:
            query += ' AND reviewed=?'
            params.append(reviewed)
        if controversial is not None:
            query += ' AND is_controversial=?'
            params.append(controversial)
        
        query += ' ORDER BY created_at DESC'
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [ScoringRecord(**dict(row)) for row in rows]
    
    def add_review_history(self, rh: ReviewHistory) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO review_history (record_id, reviewer, action, previous_equivalent,
                new_equivalent, previous_score, new_score, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (rh.record_id, rh.reviewer, rh.action, rh.previous_equivalent, rh.new_equivalent,
              rh.previous_score, rh.new_score, rh.reason, rh.created_at))
        rh.id = cursor.lastrowid
        conn.commit()
        conn.close()
        return rh.id
    
    def get_review_history(self, record_id: int = None) -> List[ReviewHistory]:
        conn = self._get_conn()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if record_id:
            cursor.execute('SELECT * FROM review_history WHERE record_id=? ORDER BY created_at DESC', (record_id,))
        else:
            cursor.execute('SELECT * FROM review_history ORDER BY created_at DESC')
        
        rows = cursor.fetchall()
        conn.close()
        return [ReviewHistory(**dict(row)) for row in rows]
    
    def get_all_error_questions(self) -> List[ErrorQuestion]:
        conn = self._get_conn()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM error_questions ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [ErrorQuestion(**dict(row)) for row in rows]
    
    def clear_all(self):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM error_questions')
        cursor.execute('DELETE FROM scoring_records')
        cursor.execute('DELETE FROM review_history')
        conn.commit()
        conn.close()
