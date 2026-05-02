import os
import sqlite3
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from config import Config


class DatabaseManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_db()
    
    def _ensure_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def execute(self, query: str, params: tuple = (), commit: bool = True):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            if commit:
                conn.commit()
            return cursor.lastrowid
    
    def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    def fetch_all(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]


class MainDatabase(DatabaseManager):
    def __init__(self):
        super().__init__(Config.get_db_path())
        self._init_tables()
    
    def _init_tables(self):
        queries = [
            '''
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                scan_directory TEXT NOT NULL,
                index_csv_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                config_json TEXT DEFAULT '{}'
            )
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)
            '''
        ]
        for query in queries:
            self.execute(query)
    
    def create_project(self, name: str, scan_directory: str, 
                       index_csv_path: str = None, config: Dict = None) -> int:
        config_json = json.dumps(config or {})
        return self.execute(
            '''
            INSERT INTO projects (name, scan_directory, index_csv_path, config_json, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''',
            (name, scan_directory, index_csv_path, config_json)
        )
    
    def update_project(self, project_id: int, name: str = None, 
                       scan_directory: str = None, index_csv_path: str = None,
                       config: Dict = None):
        updates = []
        params = []
        
        if name:
            updates.append("name = ?")
            params.append(name)
        if scan_directory:
            updates.append("scan_directory = ?")
            params.append(scan_directory)
        if index_csv_path:
            updates.append("index_csv_path = ?")
            params.append(index_csv_path)
        if config is not None:
            updates.append("config_json = ?")
            params.append(json.dumps(config))
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(project_id)
        
        self.execute(
            f"UPDATE projects SET {', '.join(updates)} WHERE id = ?",
            tuple(params)
        )
    
    def get_project(self, project_id: int) -> Optional[Dict]:
        row = self.fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,))
        if row:
            row['config'] = json.loads(row.get('config_json', '{}'))
        return row
    
    def list_projects(self) -> List[Dict]:
        rows = self.fetch_all("SELECT * FROM projects ORDER BY updated_at DESC")
        for row in rows:
            row['config'] = json.loads(row.get('config_json', '{}'))
        return rows
    
    def delete_project(self, project_id: int):
        self.execute("DELETE FROM projects WHERE id = ?", (project_id,))


class ProjectDatabase(DatabaseManager):
    def __init__(self, project_id: int):
        super().__init__(Config.get_db_path(project_id))
        self._init_tables()
    
    def _init_tables(self):
        queries = [
            '''
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                file_type TEXT,
                size INTEGER,
                width INTEGER,
                height INTEGER,
                resolution INTEGER,
                orientation TEXT,
                is_blank INTEGER DEFAULT 0,
                blank_confidence REAL DEFAULT 0.0,
                metadata_json TEXT DEFAULT '{}',
                scanned_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''',
            '''
            CREATE TABLE IF NOT EXISTS index_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                box_number TEXT,
                case_number TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                expected_filename TEXT,
                original_row_json TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''',
            '''
            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_type TEXT NOT NULL,
                severity TEXT DEFAULT 'warning',
                description TEXT,
                file_id INTEGER,
                index_record_id INTEGER,
                affected_files TEXT,
                affected_pages TEXT,
                review_status TEXT DEFAULT 'pending',
                review_note TEXT,
                reviewed_by TEXT,
                reviewed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files (id),
                FOREIGN KEY (index_record_id) REFERENCES index_records (id)
            )
            ''',
            '''
            CREATE TABLE IF NOT EXISTS export_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                export_path TEXT NOT NULL,
                manifest_path TEXT,
                file_count INTEGER,
                issue_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(review_status)
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(issue_type)
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename)
            '''
        ]
        for query in queries:
            self.execute(query)
    
    def add_file(self, file_data: Dict) -> int:
        return self.execute(
            '''
            INSERT INTO files (filename, filepath, file_type, size, width, height,
                              resolution, orientation, is_blank, blank_confidence, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                file_data.get('filename'),
                file_data.get('filepath'),
                file_data.get('file_type'),
                file_data.get('size'),
                file_data.get('width'),
                file_data.get('height'),
                file_data.get('resolution'),
                file_data.get('orientation'),
                1 if file_data.get('is_blank') else 0,
                file_data.get('blank_confidence', 0.0),
                json.dumps(file_data.get('metadata', {}))
            )
        )
    
    def batch_add_files(self, files_data: List[Dict]):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for file_data in files_data:
                cursor.execute(
                    '''
                    INSERT INTO files (filename, filepath, file_type, size, width, height,
                                      resolution, orientation, is_blank, blank_confidence, metadata_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        file_data.get('filename'),
                        file_data.get('filepath'),
                        file_data.get('file_type'),
                        file_data.get('size'),
                        file_data.get('width'),
                        file_data.get('height'),
                        file_data.get('resolution'),
                        file_data.get('orientation'),
                        1 if file_data.get('is_blank') else 0,
                        file_data.get('blank_confidence', 0.0),
                        json.dumps(file_data.get('metadata', {}))
                    )
                )
            conn.commit()
    
    def get_all_files(self) -> List[Dict]:
        rows = self.fetch_all("SELECT * FROM files ORDER BY filename")
        for row in rows:
            row['metadata'] = json.loads(row.get('metadata_json', '{}'))
            row['is_blank'] = bool(row.get('is_blank', 0))
        return rows
    
    def get_file_by_id(self, file_id: int) -> Optional[Dict]:
        row = self.fetch_one("SELECT * FROM files WHERE id = ?", (file_id,))
        if row:
            row['metadata'] = json.loads(row.get('metadata_json', '{}'))
            row['is_blank'] = bool(row.get('is_blank', 0))
        return row
    
    def get_file_by_filename(self, filename: str) -> Optional[Dict]:
        row = self.fetch_one("SELECT * FROM files WHERE filename = ?", (filename,))
        if row:
            row['metadata'] = json.loads(row.get('metadata_json', '{}'))
            row['is_blank'] = bool(row.get('is_blank', 0))
        return row
    
    def clear_files(self):
        self.execute("DELETE FROM files")
    
    def add_index_record(self, record_data: Dict) -> int:
        return self.execute(
            '''
            INSERT INTO index_records (box_number, case_number, page_number, expected_filename, original_row_json)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (
                record_data.get('box_number'),
                record_data.get('case_number'),
                record_data.get('page_number'),
                record_data.get('expected_filename'),
                json.dumps(record_data.get('original_row', {}))
            )
        )
    
    def batch_add_index_records(self, records_data: List[Dict]):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for record_data in records_data:
                cursor.execute(
                    '''
                    INSERT INTO index_records (box_number, case_number, page_number, expected_filename, original_row_json)
                    VALUES (?, ?, ?, ?, ?)
                    ''',
                    (
                        record_data.get('box_number'),
                        record_data.get('case_number'),
                        record_data.get('page_number'),
                        record_data.get('expected_filename'),
                        json.dumps(record_data.get('original_row', {}))
                    )
                )
            conn.commit()
    
    def get_all_index_records(self) -> List[Dict]:
        rows = self.fetch_all("SELECT * FROM index_records ORDER BY case_number, page_number")
        for row in rows:
            row['original_row'] = json.loads(row.get('original_row_json', '{}'))
        return rows
    
    def get_index_records_by_case(self, case_number: str) -> List[Dict]:
        rows = self.fetch_all(
            "SELECT * FROM index_records WHERE case_number = ? ORDER BY page_number",
            (case_number,)
        )
        for row in rows:
            row['original_row'] = json.loads(row.get('original_row_json', '{}'))
        return rows
    
    def get_all_case_numbers(self) -> List[str]:
        rows = self.fetch_all("SELECT DISTINCT case_number FROM index_records ORDER BY case_number")
        return [row['case_number'] for row in rows]
    
    def clear_index_records(self):
        self.execute("DELETE FROM index_records")
    
    def add_issue(self, issue_data: Dict) -> int:
        return self.execute(
            '''
            INSERT INTO issues (issue_type, severity, description, file_id, index_record_id,
                              affected_files, affected_pages, review_status, review_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                issue_data.get('issue_type'),
                issue_data.get('severity', 'warning'),
                issue_data.get('description'),
                issue_data.get('file_id'),
                issue_data.get('index_record_id'),
                json.dumps(issue_data.get('affected_files', [])) if issue_data.get('affected_files') else None,
                json.dumps(issue_data.get('affected_pages', [])) if issue_data.get('affected_pages') else None,
                issue_data.get('review_status', 'pending'),
                issue_data.get('review_note')
            )
        )
    
    def batch_add_issues(self, issues_data: List[Dict]):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for issue_data in issues_data:
                cursor.execute(
                    '''
                    INSERT INTO issues (issue_type, severity, description, file_id, index_record_id,
                                      affected_files, affected_pages, review_status, review_note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (
                        issue_data.get('issue_type'),
                        issue_data.get('severity', 'warning'),
                        issue_data.get('description'),
                        issue_data.get('file_id'),
                        issue_data.get('index_record_id'),
                        json.dumps(issue_data.get('affected_files', [])) if issue_data.get('affected_files') else None,
                        json.dumps(issue_data.get('affected_pages', [])) if issue_data.get('affected_pages') else None,
                        issue_data.get('review_status', 'pending'),
                        issue_data.get('review_note')
                    )
                )
            conn.commit()
    
    def get_issues(self, review_status: str = None, issue_type: str = None) -> List[Dict]:
        query = "SELECT * FROM issues WHERE 1=1"
        params = []
        
        if review_status:
            query += " AND review_status = ?"
            params.append(review_status)
        if issue_type:
            query += " AND issue_type = ?"
            params.append(issue_type)
        
        query += " ORDER BY created_at DESC"
        
        rows = self.fetch_all(query, tuple(params))
        for row in rows:
            if row.get('affected_files'):
                row['affected_files'] = json.loads(row['affected_files'])
            if row.get('affected_pages'):
                row['affected_pages'] = json.loads(row['affected_pages'])
        return rows
    
    def get_issue_by_id(self, issue_id: int) -> Optional[Dict]:
        row = self.fetch_one("SELECT * FROM issues WHERE id = ?", (issue_id,))
        if row:
            if row.get('affected_files'):
                row['affected_files'] = json.loads(row['affected_files'])
            if row.get('affected_pages'):
                row['affected_pages'] = json.loads(row['affected_pages'])
        return row
    
    def update_issue_review(self, issue_id: int, status: str, note: str = None):
        self.execute(
            '''
            UPDATE issues SET review_status = ?, review_note = ?, 
                             reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'user'
            WHERE id = ?
            ''',
            (status, note, issue_id)
        )
    
    def clear_issues(self):
        self.execute("DELETE FROM issues")
    
    def get_issue_statistics(self) -> Dict:
        stats = {}
        
        total_issues = self.fetch_one(
            "SELECT COUNT(*) as count FROM issues"
        )['count']
        
        stats['total'] = total_issues
        
        status_counts = self.fetch_all(
            "SELECT review_status, COUNT(*) as count FROM issues GROUP BY review_status"
        )
        stats['by_status'] = {row['review_status']: row['count'] for row in status_counts}
        
        type_counts = self.fetch_all(
            "SELECT issue_type, COUNT(*) as count FROM issues GROUP BY issue_type"
        )
        stats['by_type'] = {row['issue_type']: row['count'] for row in type_counts}
        
        return stats
    
    def add_export_record(self, export_path: str, manifest_path: str = None,
                          file_count: int = 0, issue_count: int = 0) -> int:
        return self.execute(
            '''
            INSERT INTO export_history (export_path, manifest_path, file_count, issue_count)
            VALUES (?, ?, ?, ?)
            ''',
            (export_path, manifest_path, file_count, issue_count)
        )
    
    def get_export_history(self, limit: int = 10) -> List[Dict]:
        return self.fetch_all(
            "SELECT * FROM export_history ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
