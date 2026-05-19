import sqlite3
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from models import HiddenDanger, PhotoRecord, ReviewRecord, BadRecord

class Database:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = os.path.join(os.path.dirname(__file__), 'data', 'safety.db')
        
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self._init_tables()
    
    def _init_tables(self):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS hidden_dangers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hazard_id TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL,
                location TEXT,
                person_in_charge TEXT,
                status TEXT DEFAULT 'open',
                exception_type TEXT,
                discovered_date TEXT,
                deadline TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS photo_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id TEXT UNIQUE NOT NULL,
                hazard_id TEXT NOT NULL,
                file_path TEXT,
                photo_type TEXT,
                uploaded_at TEXT,
                uploaded_by TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (hazard_id) REFERENCES hidden_dangers(hazard_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS review_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_id TEXT UNIQUE NOT NULL,
                hazard_id TEXT NOT NULL,
                reviewer TEXT,
                review_date TEXT,
                result TEXT,
                remarks TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (hazard_id) REFERENCES hidden_dangers(hazard_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bad_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_file TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                raw_data TEXT NOT NULL,
                failure_reason TEXT NOT NULL,
                suggestion TEXT,
                created_at TEXT NOT NULL
            )
        ''')
        
        self.conn.commit()
    
    def insert_hazard(self, hazard: HiddenDanger) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO hidden_dangers 
                (hazard_id, description, location, person_in_charge, status, 
                 exception_type, discovered_date, deadline, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                hazard.hazard_id, hazard.description, hazard.location,
                hazard.person_in_charge, hazard.status, hazard.exception_type,
                hazard.discovered_date, hazard.deadline, hazard.created_at,
                hazard.updated_at
            ))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            cursor.execute('''
                UPDATE hidden_dangers SET
                    description=?, location=?, person_in_charge=?, status=?,
                    exception_type=?, discovered_date=?, deadline=?, updated_at=?
                WHERE hazard_id=?
            ''', (
                hazard.description, hazard.location, hazard.person_in_charge,
                hazard.status, hazard.exception_type, hazard.discovered_date,
                hazard.deadline, hazard.updated_at, hazard.hazard_id
            ))
            self.conn.commit()
            cursor.execute('SELECT id FROM hidden_dangers WHERE hazard_id=?', (hazard.hazard_id,))
            return cursor.fetchone()[0]
    
    def insert_photo(self, photo: PhotoRecord) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO photo_records
                (photo_id, hazard_id, file_path, photo_type, uploaded_at, uploaded_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                photo.photo_id, photo.hazard_id, photo.file_path,
                photo.photo_type, photo.uploaded_at, photo.uploaded_by,
                datetime.now().isoformat()
            ))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return cursor.execute('SELECT id FROM photo_records WHERE photo_id=?', (photo.photo_id,)).fetchone()[0]
    
    def insert_review(self, review: ReviewRecord) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO review_records
                (review_id, hazard_id, reviewer, review_date, result, remarks, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                review.review_id, review.hazard_id, review.reviewer,
                review.review_date, review.result, review.remarks,
                review.created_at
            ))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return cursor.execute('SELECT id FROM review_records WHERE review_id=?', (review.review_id,)).fetchone()[0]
    
    def insert_bad_record(self, bad: BadRecord) -> int:
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO bad_records
            (source_type, source_file, line_number, raw_data, failure_reason, suggestion, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            bad.source_type, bad.source_file, bad.line_number,
            bad.raw_data, bad.failure_reason, bad.suggestion, bad.created_at
        ))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_all_hazards(self) -> List[HiddenDanger]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM hidden_dangers ORDER BY created_at DESC')
        rows = cursor.fetchall()
        return [self._row_to_hazard(row) for row in rows]
    
    def query_hazards(self, **filters) -> List[HiddenDanger]:
        cursor = self.conn.cursor()
        query = 'SELECT * FROM hidden_dangers WHERE 1=1'
        params = []
        
        if filters.get('person_in_charge'):
            query += ' AND person_in_charge LIKE ?'
            params.append(f'%{filters["person_in_charge"]}%')
        
        if filters.get('status'):
            query += ' AND status = ?'
            params.append(filters['status'])
        
        if filters.get('start_date'):
            query += ' AND discovered_date >= ?'
            params.append(filters['start_date'])
        
        if filters.get('end_date'):
            query += ' AND discovered_date <= ?'
            params.append(filters['end_date'])
        
        if filters.get('exception_type'):
            query += ' AND exception_type LIKE ?'
            params.append(f'%{filters["exception_type"]}%')
        
        query += ' ORDER BY created_at DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [self._row_to_hazard(row) for row in rows]
    
    def get_all_bad_records(self) -> List[BadRecord]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM bad_records ORDER BY created_at DESC')
        rows = cursor.fetchall()
        return [self._row_to_bad_record(row) for row in rows]
    
    def _row_to_hazard(self, row) -> HiddenDanger:
        return HiddenDanger(
            id=row[0], hazard_id=row[1], description=row[2], location=row[3],
            person_in_charge=row[4], status=row[5], exception_type=row[6],
            discovered_date=row[7], deadline=row[8], created_at=row[9],
            updated_at=row[10]
        )
    
    def _row_to_bad_record(self, row) -> BadRecord:
        return BadRecord(
            id=row[0], source_type=row[1], source_file=row[2],
            line_number=row[3], raw_data=row[4], failure_reason=row[5],
            suggestion=row[6], created_at=row[7]
        )
    
    def get_stats(self) -> Dict[str, Any]:
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM hidden_dangers')
        total_hazards = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM photo_records')
        total_photos = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM review_records')
        total_reviews = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM bad_records')
        total_bad = cursor.fetchone()[0]
        
        cursor.execute('SELECT status, COUNT(*) FROM hidden_dangers GROUP BY status')
        by_status = dict(cursor.fetchall())
        
        cursor.execute('''
            SELECT person_in_charge, COUNT(*) 
            FROM hidden_dangers 
            WHERE person_in_charge IS NOT NULL AND person_in_charge != ''
            GROUP BY person_in_charge 
            ORDER BY COUNT(*) DESC
        ''')
        by_person = dict(cursor.fetchall())
        
        return {
            'total_hazards': total_hazards,
            'total_photos': total_photos,
            'total_reviews': total_reviews,
            'total_bad_records': total_bad,
            'by_status': by_status,
            'by_person': by_person
        }
    
    def close(self):
        self.conn.close()
    
    def __del__(self):
        self.close()
