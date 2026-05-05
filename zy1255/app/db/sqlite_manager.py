import sqlite3
import os
import csv
import uuid
import time
import threading
from contextlib import contextmanager
from typing import List, Dict, Any, Optional, Tuple, Generator
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class QueryResult:
    rows: List[Tuple[Any, ...]]
    columns: List[str]
    row_count: int
    execution_time_ms: float
    error: Optional[str] = None
    
    def to_dict_list(self) -> List[Dict[str, Any]]:
        if not self.columns or not self.rows:
            return []
        return [dict(zip(self.columns, row)) for row in self.rows]


@dataclass
class ExplainPlan:
    steps: List[Dict[str, Any]]
    raw_output: str
    estimated_rows: Optional[int] = None


class TempSQLiteDatabase:
    def __init__(self, temp_dir: str = '/tmp/sql_validator'):
        self.temp_dir = temp_dir
        self.db_path = None
        self._connection = None
        self._lock = threading.Lock()
        self._created = False
        
        os.makedirs(temp_dir, exist_ok=True)
    
    def create(self) -> str:
        with self._lock:
            if self._created:
                return self.db_path
            
            db_id = uuid.uuid4().hex
            self.db_path = os.path.join(self.temp_dir, f'db_{db_id}.sqlite')
            
            self._connection = sqlite3.connect(self.db_path, check_same_thread=False)
            self._connection.row_factory = sqlite3.Row
            
            self._connection.execute('PRAGMA foreign_keys = ON')
            self._connection.execute('PRAGMA journal_mode = MEMORY')
            self._connection.execute('PRAGMA synchronous = OFF')
            self._connection.commit()
            
            self._created = True
            return self.db_path
    
    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        if not self._created:
            self.create()
        
        with self._lock:
            yield self._connection
    
    def execute_schema(self, schema_sql: str) -> Dict[str, Any]:
        result = {
            'success': True,
            'error': None,
            'tables_created': []
        }
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.executescript(schema_sql)
                conn.commit()
                
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """)
                tables = [row[0] for row in cursor.fetchall()]
                result['tables_created'] = tables
                
        except sqlite3.Error as e:
            result['success'] = False
            result['error'] = str(e)
        
        return result
    
    def import_csv(self, table_name: str, csv_content: str, has_header: bool = True) -> Dict[str, Any]:
        result = {
            'success': True,
            'error': None,
            'rows_imported': 0
        }
        
        try:
            lines = csv_content.strip().split('\n')
            if not lines:
                return result
            
            reader = csv.reader(lines)
            headers = None
            rows = []
            
            for i, row in enumerate(reader):
                if i == 0 and has_header:
                    headers = row
                    continue
                processed_row = [None if v.strip() == '' else v for v in row]
                rows.append(processed_row)
            
            if not headers:
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(f"PRAGMA table_info({table_name})")
                    headers = [row[1] for row in cursor.fetchall()]
            
            if headers and rows:
                placeholders = ', '.join(['?'] * len(headers))
                columns = ', '.join([f'"{h}"' for h in headers])
                sql = f'INSERT INTO "{table_name}" ({columns}) VALUES ({placeholders})'
                
                with self.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.executemany(sql, rows)
                    conn.commit()
                    result['rows_imported'] = cursor.rowcount
            
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        
        return result
    
    def execute_query(self, sql: str, timeout: int = 30) -> QueryResult:
        start_time = time.time()
        
        try:
            with self.get_connection() as conn:
                conn.execute(f"PRAGMA query_timeout = {timeout * 1000}")
                cursor = conn.cursor()
                cursor.execute(sql)
                
                rows = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                
                execution_time_ms = (time.time() - start_time) * 1000
                
                return QueryResult(
                    rows=[tuple(row) for row in rows],
                    columns=columns,
                    row_count=len(rows),
                    execution_time_ms=execution_time_ms
                )
                
        except sqlite3.Error as e:
            execution_time_ms = (time.time() - start_time) * 1000
            return QueryResult(
                rows=[],
                columns=[],
                row_count=0,
                execution_time_ms=execution_time_ms,
                error=str(e)
            )
    
    def explain_query(self, sql: str) -> ExplainPlan:
        explain_sql = f"EXPLAIN QUERY PLAN {sql}"
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(explain_sql)
                
                rows = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                
                steps = []
                for row in rows:
                    step = dict(zip(columns, row))
                    steps.append(step)
                
                raw_output = '\n'.join([str(row) for row in rows])
                
                estimated_rows = None
                for step in steps:
                    if 'rows' in step and step['rows']:
                        try:
                            estimated_rows = int(step['rows'])
                            break
                        except (ValueError, TypeError):
                            pass
                
                return ExplainPlan(
                    steps=steps,
                    raw_output=raw_output,
                    estimated_rows=estimated_rows
                )
                
        except sqlite3.Error as e:
            return ExplainPlan(
                steps=[],
                raw_output=f"Error: {str(e)}",
                estimated_rows=None
            )
    
    def get_table_info(self, table_name: str) -> List[Dict[str, Any]]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = [desc[0] for desc in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except sqlite3.Error:
            return []
    
    def list_tables(self) -> List[str]:
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """)
                return [row[0] for row in cursor.fetchall()]
        except sqlite3.Error:
            return []
    
    def close(self):
        if self._connection:
            self._connection.close()
            self._connection = None
    
    def cleanup(self):
        self.close()
        if self.db_path and os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except OSError:
                pass
        self._created = False


class SQLiteManager:
    def __init__(self, temp_dir: str = '/tmp/sql_validator'):
        self.temp_dir = temp_dir
        self._databases: Dict[str, TempSQLiteDatabase] = {}
    
    def create_database(self) -> Tuple[str, TempSQLiteDatabase]:
        db = TempSQLiteDatabase(self.temp_dir)
        db_id = db.create()
        self._databases[db_id] = db
        return db_id, db
    
    def get_database(self, db_id: str) -> Optional[TempSQLiteDatabase]:
        return self._databases.get(db_id)
    
    def close_database(self, db_id: str):
        if db_id in self._databases:
            self._databases[db_id].close()
    
    def cleanup_database(self, db_id: str):
        if db_id in self._databases:
            self._databases[db_id].cleanup()
            del self._databases[db_id]
    
    def cleanup_all(self):
        for db_id in list(self._databases.keys()):
            self.cleanup_database(db_id)
