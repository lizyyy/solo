
import sqlite3
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ReviewState:
    image_id: str
    colony_id: str
    accepted: bool
    marked_contamination: bool
    marked_missing: bool
    marked_overlap: bool
    notes: str
    reviewed_at: Optional[str] = None


class Database:
    def __init__(self, db_path: str = "colony_review.db"):
        self.db_path = db_path
        self.conn = None
        self._connect()
        self._init_tables()
    
    def _connect(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
    
    def _init_tables(self):
        cursor = self.conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id TEXT NOT NULL,
                colony_id TEXT NOT NULL,
                accepted BOOLEAN DEFAULT 1,
                marked_contamination BOOLEAN DEFAULT 0,
                marked_missing BOOLEAN DEFAULT 0,
                marked_overlap BOOLEAN DEFAULT 0,
                notes TEXT,
                reviewed_at TIMESTAMP,
                UNIQUE(image_id, colony_id)
            )
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_image_id ON reviews(image_id)
        ''')
        
        self.conn.commit()
    
    def save_review(self, review: ReviewState):
        cursor = self.conn.cursor()
        now = datetime.now().isoformat()
        
        cursor.execute('''
            INSERT OR REPLACE INTO reviews 
            (image_id, colony_id, accepted, marked_contamination, marked_missing, marked_overlap, notes, reviewed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            review.image_id,
            review.colony_id,
            review.accepted,
            review.marked_contamination,
            review.marked_missing,
            review.marked_overlap,
            review.notes,
            now
        ))
        
        self.conn.commit()
    
    def get_review(self, image_id: str, colony_id: str) -&gt; Optional[ReviewState]:
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM reviews WHERE image_id = ? AND colony_id = ?
        ''', (image_id, colony_id))
        
        row = cursor.fetchone()
        if row:
            return ReviewState(
                image_id=row['image_id'],
                colony_id=row['colony_id'],
                accepted=bool(row['accepted']),
                marked_contamination=bool(row['marked_contamination']),
                marked_missing=bool(row['marked_missing']),
                marked_overlap=bool(row['marked_overlap']),
                notes=row['notes'],
                reviewed_at=row['reviewed_at']
            )
        return None
    
    def get_image_reviews(self, image_id: str) -&gt; Dict[str, ReviewState]:
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM reviews WHERE image_id = ?
        ''', (image_id,))
        
        reviews = {}
        for row in cursor.fetchall():
            reviews[row['colony_id']] = ReviewState(
                image_id=row['image_id'],
                colony_id=row['colony_id'],
                accepted=bool(row['accepted']),
                marked_contamination=bool(row['marked_contamination']),
                marked_missing=bool(row['marked_missing']),
                marked_overlap=bool(row['marked_overlap']),
                notes=row['notes'],
                reviewed_at=row['reviewed_at']
            )
        return reviews
    
    def get_all_reviews(self) -&gt; List[ReviewState]:
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM reviews')
        
        reviews = []
        for row in cursor.fetchall():
            reviews.append(ReviewState(
                image_id=row['image_id'],
                colony_id=row['colony_id'],
                accepted=bool(row['accepted']),
                marked_contamination=bool(row['marked_contamination']),
                marked_missing=bool(row['marked_missing']),
                marked_overlap=bool(row['marked_overlap']),
                notes=row['notes'],
                reviewed_at=row['reviewed_at']
            ))
        return reviews
    
    def get_review_stats(self) -&gt; Dict:
        cursor = self.conn.cursor()
        
        cursor.execute('SELECT COUNT(DISTINCT image_id) FROM reviews')
        total_images = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reviews')
        total_colonies = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reviews WHERE accepted = 1')
        accepted = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reviews WHERE marked_contamination = 1')
        contamination = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reviews WHERE marked_missing = 1')
        missing = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM reviews WHERE marked_overlap = 1')
        overlap = cursor.fetchone()[0]
        
        return {
            'total_images': total_images,
            'total_colonies': total_colonies,
            'accepted': accepted,
            'rejected': total_colonies - accepted,
            'contamination': contamination,
            'missing': missing,
            'overlap': overlap
        }
    
    def close(self):
        if self.conn:
            self.conn.close()

