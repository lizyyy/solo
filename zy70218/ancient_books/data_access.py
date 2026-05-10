from typing import List, Dict, Optional, Any
from pathlib import Path
from datetime import datetime
import json

from .database import Database


class DataAccess:
    def __init__(self, db: Database):
        self.db = db
    
    def create_scan_session(self, scan_dir: str) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO scan_sessions (scan_dir) VALUES (?)",
                (scan_dir,)
            )
            return cursor.lastrowid
    
    def update_scan_session_stats(self, session_id: int, total_files: int, 
                                   parsed_files: int, failed_files: int):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE scan_sessions 
                SET total_files = ?, parsed_files = ?, failed_files = ?
                WHERE id = ?
            ''', (total_files, parsed_files, failed_files, session_id))
    
    def insert_scanned_file(self, session_id: int, file_path: str, file_name: str,
                            file_size: Optional[int], modification_time: Optional[str],
                            volume_number: Optional[int], page_number: Optional[int],
                            file_extension: Optional[str], parse_status: str,
                            parse_error: Optional[str]) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO scanned_files 
                (session_id, file_path, file_name, file_size, modification_time,
                 volume_number, page_number, file_extension, parse_status, parse_error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (session_id, file_path, file_name, file_size, modification_time,
                  volume_number, page_number, file_extension, parse_status, parse_error))
            return cursor.lastrowid
    
    def get_scan_sessions(self) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, scan_dir, scan_time, total_files, parsed_files, failed_files
                FROM scan_sessions
                ORDER BY scan_time DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_scanned_files(self, session_id: Optional[int] = None, 
                          parse_status: Optional[str] = None) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT id, session_id, file_path, file_name, file_size, modification_time,
                       volume_number, page_number, file_extension, parse_status, parse_error,
                       created_at
                FROM scanned_files
            '''
            conditions = []
            params = []
            
            if session_id is not None:
                conditions.append("session_id = ?")
                params.append(session_id)
            
            if parse_status is not None:
                conditions.append("parse_status = ?")
                params.append(parse_status)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            query += " ORDER BY volume_number, page_number"
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def create_check_run(self, description: Optional[str] = None) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO check_runs (description) VALUES (?)",
                (description,)
            )
            return cursor.lastrowid
    
    def insert_volume(self, check_run_id: int, volume_number: int,
                      expected_start_page: Optional[int] = None,
                      expected_end_page: Optional[int] = None,
                      actual_start_page: Optional[int] = None,
                      actual_end_page: Optional[int] = None,
                      expected_page_count: Optional[int] = None,
                      actual_page_count: Optional[int] = None,
                      status: str = 'pending') -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO volumes 
                (check_run_id, volume_number, expected_start_page, expected_end_page,
                 actual_start_page, actual_end_page, expected_page_count, actual_page_count, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (check_run_id, volume_number, expected_start_page, expected_end_page,
                  actual_start_page, actual_end_page, expected_page_count, actual_page_count, status))
            return cursor.lastrowid
    
    def insert_page_check(self, check_run_id: int, volume_number: int, page_number: int,
                          file_path: Optional[str], status: str, issues: Optional[str] = None) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO page_checks 
                (check_run_id, volume_number, page_number, file_path, status, issues)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (check_run_id, volume_number, page_number, file_path, status, issues))
            return cursor.lastrowid
    
    def get_check_runs(self) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, run_time, description
                FROM check_runs
                ORDER BY run_time DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    def get_latest_check_run(self) -> Optional[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, run_time, description
                FROM check_runs
                ORDER BY run_time DESC
                LIMIT 1
            ''')
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_volumes(self, check_run_id: int) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, check_run_id, volume_number, expected_start_page, expected_end_page,
                       actual_start_page, actual_end_page, expected_page_count, actual_page_count, status
                FROM volumes
                WHERE check_run_id = ?
                ORDER BY volume_number
            ''', (check_run_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_page_checks(self, check_run_id: int, volume_number: Optional[int] = None,
                        status: Optional[str] = None) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT id, check_run_id, volume_number, page_number, file_path, status, issues
                FROM page_checks
                WHERE check_run_id = ?
            '''
            params = [check_run_id]
            
            if volume_number is not None:
                query += " AND volume_number = ?"
                params.append(volume_number)
            
            if status is not None:
                query += " AND status = ?"
                params.append(status)
            
            query += " ORDER BY volume_number, page_number"
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def insert_exception(self, exception_type: str, title: str, severity: str = 'error',
                        description: Optional[str] = None, check_run_id: Optional[int] = None,
                        source_type: Optional[str] = None, source_reference: Optional[str] = None,
                        source_data: Optional[Dict[str, Any]] = None) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            source_data_json = json.dumps(source_data) if source_data else None
            cursor.execute('''
                INSERT INTO exceptions 
                (check_run_id, exception_type, severity, title, description,
                 source_type, source_reference, source_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (check_run_id, exception_type, severity, title, description,
                  source_type, source_reference, source_data_json))
            return cursor.lastrowid
    
    def get_exceptions(self, resolved: Optional[bool] = None, 
                       exception_type: Optional[str] = None,
                       check_run_id: Optional[int] = None) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT id, check_run_id, exception_type, severity, title, description,
                       source_type, source_reference, source_data, resolved, resolved_at,
                       resolved_by, created_at
                FROM exceptions
            '''
            conditions = []
            params = []
            
            if resolved is not None:
                conditions.append("resolved = ?")
                params.append(1 if resolved else 0)
            
            if exception_type is not None:
                conditions.append("exception_type = ?")
                params.append(exception_type)
            
            if check_run_id is not None:
                conditions.append("check_run_id = ?")
                params.append(check_run_id)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            query += " ORDER BY created_at DESC"
            
            cursor.execute(query, params)
            results = [dict(row) for row in cursor.fetchall()]
            
            for result in results:
                if result['source_data']:
                    result['source_data'] = json.loads(result['source_data'])
            
            return results
    
    def resolve_exception(self, exception_id: int, resolved_by: str = 'manual'):
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE exceptions
                SET resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
                WHERE id = ?
            ''', (resolved_by, exception_id))
    
    def insert_revision(self, entity_type: str, entity_id: int, action: str,
                        old_value: Optional[str] = None, new_value: Optional[str] = None,
                        change_reason: Optional[str] = None, changed_by: str = 'system') -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO revisions 
                (entity_type, entity_id, action, old_value, new_value, change_reason, changed_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (entity_type, entity_id, action, old_value, new_value, change_reason, changed_by))
            return cursor.lastrowid
    
    def get_revisions(self, entity_type: Optional[str] = None, 
                      entity_id: Optional[int] = None,
                      limit: int = 100) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT id, entity_type, entity_id, action, old_value, new_value,
                       change_reason, changed_at, changed_by
                FROM revisions
            '''
            conditions = []
            params = []
            
            if entity_type is not None:
                conditions.append("entity_type = ?")
                params.append(entity_type)
            
            if entity_id is not None:
                conditions.append("entity_id = ?")
                params.append(entity_id)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            query += " ORDER BY changed_at DESC LIMIT ?"
            params.append(limit)
            
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    def insert_manual_fix(self, file_path: str, original_volume: Optional[int],
                         original_page: Optional[int], corrected_volume: Optional[int],
                         corrected_page: Optional[int], fix_reason: Optional[str] = None) -> int:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO manual_fixes 
                (file_path, original_volume, original_page, corrected_volume, corrected_page, fix_reason)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (file_path, original_volume, original_page, corrected_volume, corrected_page, fix_reason))
            return cursor.lastrowid
    
    def get_manual_fixes(self) -> List[Dict]:
        with self.db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, file_path, original_volume, original_page, 
                       corrected_volume, corrected_page, fix_reason, created_at
                FROM manual_fixes
                ORDER BY created_at DESC
            ''')
            return [dict(row) for row in cursor.fetchall()]
