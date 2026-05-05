import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

from tree_patrol.models import (
    TreeStatus,
    ReviewRecord
)


class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            self.db_path = Path(__file__).parent.parent.parent / "tree_patrol.db"
        else:
            self.db_path = Path(db_path)
        self._init_database()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_database(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS review_records (
                    id TEXT PRIMARY KEY,
                    tree_id TEXT NOT NULL,
                    assessment_id TEXT NOT NULL,
                    review_date TEXT NOT NULL,
                    reviewer TEXT NOT NULL,
                    original_status TEXT NOT NULL,
                    final_status TEXT NOT NULL,
                    review_notes TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_review_tree_id 
                ON review_records(tree_id)
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_review_date 
                ON review_records(review_date)
            ''')
            
            conn.commit()

    def save_review_record(self, review: ReviewRecord) -> bool:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT OR REPLACE INTO review_records 
                    (id, tree_id, assessment_id, review_date, reviewer, 
                     original_status, final_status, review_notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    review.id,
                    review.tree_id,
                    review.assessment_id,
                    review.review_date.isoformat(),
                    review.reviewer,
                    review.original_status.value,
                    review.final_status.value,
                    review.review_notes
                ))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"保存复核记录失败: {e}")
            return False

    def get_review_by_id(self, review_id: str) -> Optional[ReviewRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM review_records WHERE id = ?',
                (review_id,)
            )
            row = cursor.fetchone()
            
            if row:
                return self._row_to_review_record(row)
            return None

    def get_reviews_by_tree_id(self, tree_id: str) -> List[ReviewRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM review_records WHERE tree_id = ? ORDER BY review_date DESC',
                (tree_id,)
            )
            rows = cursor.fetchall()
            
            return [self._row_to_review_record(row) for row in rows]

    def get_reviews_by_date_range(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[ReviewRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM review_records 
                WHERE review_date >= ? AND review_date <= ? 
                ORDER BY review_date DESC
            ''', (
                start_date.isoformat(),
                end_date.isoformat()
            ))
            rows = cursor.fetchall()
            
            return [self._row_to_review_record(row) for row in rows]

    def get_all_reviews(self) -> List[ReviewRecord]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM review_records ORDER BY review_date DESC')
            rows = cursor.fetchall()
            
            return [self._row_to_review_record(row) for row in rows]

    def delete_review_record(self, review_id: str) -> bool:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'DELETE FROM review_records WHERE id = ?',
                    (review_id,)
                )
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"删除复核记录失败: {e}")
            return False

    def _row_to_review_record(self, row: sqlite3.Row) -> ReviewRecord:
        return ReviewRecord(
            id=row['id'],
            tree_id=row['tree_id'],
            assessment_id=row['assessment_id'],
            review_date=datetime.fromisoformat(row['review_date']),
            reviewer=row['reviewer'],
            original_status=TreeStatus(row['original_status']),
            final_status=TreeStatus(row['final_status']),
            review_notes=row['review_notes']
        )

    def get_review_statistics(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) as total FROM review_records')
            total = cursor.fetchone()['total']
            
            cursor.execute('''
                SELECT final_status, COUNT(*) as count 
                FROM review_records 
                GROUP BY final_status
            ''')
            status_counts = {}
            for row in cursor.fetchall():
                status_counts[row['final_status']] = row['count']
            
            return {
                'total_reviews': total,
                'status_distribution': status_counts
            }
