import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DATABASE_PATH, ensure_data_dir


class DatabaseManager:
    _instance: Optional['DatabaseManager'] = None
    _db_path: Path = DATABASE_PATH
    
    def __new__(cls, db_path: Optional[Path] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, db_path: Optional[Path] = None):
        if self._initialized:
            return
        
        self._db_path = db_path or DATABASE_PATH
        self._connection: Optional[sqlite3.Connection] = None
        self._initialized = True
    
    def _adapt_datetime(self, dt: datetime) -> str:
        return dt.isoformat()
    
    def _convert_datetime(self, value: bytes) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.decode('utf-8'))
        except (ValueError, TypeError):
            return None
    
    def _adapt_dict(self, obj: Dict) -> str:
        return json.dumps(obj, ensure_ascii=False)
    
    def _convert_dict(self, value: bytes) -> Dict:
        if not value:
            return {}
        try:
            return json.loads(value.decode('utf-8'))
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def _adapt_list(self, obj: List) -> str:
        return json.dumps(obj, ensure_ascii=False)
    
    def _convert_list(self, value: bytes) -> List:
        if not value:
            return []
        try:
            return json.loads(value.decode('utf-8'))
        except (json.JSONDecodeError, TypeError):
            return []
    
    def _register_adapters(self):
        sqlite3.register_adapter(datetime, self._adapt_datetime)
        sqlite3.register_converter('DATETIME', self._convert_datetime)
        sqlite3.register_converter('JSON', self._convert_dict)
        sqlite3.register_converter('JSON_LIST', self._convert_list)
    
    def _get_connection(self) -> sqlite3.Connection:
        if self._connection is None:
            ensure_data_dir()
            self._register_adapters()
            self._connection = sqlite3.connect(
                self._db_path,
                detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES,
                isolation_level=None,
            )
            self._connection.row_factory = sqlite3.Row
            self._initialize_schema()
        return self._connection
    
    @contextmanager
    def get_cursor(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    
    def _initialize_schema(self):
        cursor = self._connection.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS drills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                drill_type TEXT DEFAULT '',
                description TEXT DEFAULT '',
                planned_start_time DATETIME,
                actual_start_time DATETIME,
                actual_end_time DATETIME,
                status TEXT DEFAULT '草稿',
                standard_timeline_code TEXT DEFAULT '',
                area_codes JSON_LIST DEFAULT '[]',
                observer_codes JSON_LIST DEFAULT '[]',
                event_type_codes JSON_LIST DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT DEFAULT '',
                metadata JSON DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS areas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                parent_id INTEGER,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS observers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                role TEXT DEFAULT '',
                assigned_area_codes JSON_LIST DEFAULT '[]',
                contact TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                time_offset_seconds INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS event_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                default_risk_level TEXT DEFAULT '低',
                is_key_node INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS standard_timelines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                drill_type TEXT DEFAULT '',
                nodes JSON DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drill_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT DEFAULT '',
                file_type TEXT DEFAULT 'csv',
                file_hash TEXT DEFAULT '',
                source_name TEXT DEFAULT '',
                time_offset_seconds INTEGER DEFAULT 0,
                status TEXT DEFAULT '待处理',
                total_records INTEGER DEFAULT 0,
                valid_records INTEGER DEFAULT 0,
                invalid_records INTEGER DEFAULT 0,
                error_message TEXT DEFAULT '',
                warnings JSON_LIST DEFAULT '[]',
                imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                created_by TEXT DEFAULT '',
                metadata JSON DEFAULT '{}',
                FOREIGN KEY (drill_id) REFERENCES drills (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drill_id INTEGER NOT NULL,
                import_batch_id INTEGER,
                source TEXT NOT NULL,
                original_time_str TEXT DEFAULT '',
                original_time DATETIME,
                time_offset_seconds INTEGER DEFAULT 0,
                area_code TEXT DEFAULT '',
                event_type_code TEXT DEFAULT '',
                risk_level TEXT DEFAULT '低',
                description TEXT DEFAULT '',
                person_count INTEGER,
                photo_numbers JSON_LIST DEFAULT '[]',
                notes TEXT DEFAULT '',
                review_tags JSON_LIST DEFAULT '[]',
                merge_status TEXT DEFAULT '原始',
                merged_event_id INTEGER,
                is_valid INTEGER DEFAULT 1,
                validation_errors JSON_LIST DEFAULT '[]',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}',
                FOREIGN KEY (drill_id) REFERENCES drills (id),
                FOREIGN KEY (import_batch_id) REFERENCES import_batches (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS merged_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drill_id INTEGER NOT NULL,
                unified_time DATETIME,
                area_code TEXT DEFAULT '',
                event_type_code TEXT DEFAULT '',
                risk_level TEXT DEFAULT '低',
                description TEXT DEFAULT '',
                person_count INTEGER,
                photo_numbers JSON_LIST DEFAULT '[]',
                notes TEXT DEFAULT '',
                source_event_ids JSON_LIST DEFAULT '[]',
                sources JSON_LIST DEFAULT '[]',
                review_tags JSON_LIST DEFAULT '[]',
                is_confirmed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata JSON DEFAULT '{}',
                FOREIGN KEY (drill_id) REFERENCES drills (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drill_id INTEGER NOT NULL,
                issue_type TEXT NOT NULL,
                severity TEXT DEFAULT '中',
                status TEXT DEFAULT '新发现',
                title TEXT DEFAULT '',
                description TEXT DEFAULT '',
                related_event_ids JSON_LIST DEFAULT '[]',
                related_area_codes JSON_LIST DEFAULT '[]',
                related_sources JSON_LIST DEFAULT '[]',
                detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                resolved_at DATETIME,
                resolved_by TEXT DEFAULT '',
                resolution_notes TEXT DEFAULT '',
                metadata JSON DEFAULT '{}',
                FOREIGN KEY (drill_id) REFERENCES drills (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_drill_id ON events (drill_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_source ON events (source)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_original_time ON events (original_time)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_area_code ON events (area_code)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_event_type_code ON events (event_type_code)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_drill_id ON issues (drill_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_merged_events_drill_id ON merged_events (drill_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_import_batches_drill_id ON import_batches (drill_id)')
        
        self._connection.commit()
    
    def close(self):
        if self._connection is not None:
            self._connection.close()
            self._connection = None
    
    def execute(self, sql: str, parameters: tuple = ()) -> sqlite3.Cursor:
        with self.get_cursor() as cursor:
            return cursor.execute(sql, parameters)
    
    def execute_many(self, sql: str, parameters: list) -> sqlite3.Cursor:
        with self.get_cursor() as cursor:
            return cursor.executemany(sql, parameters)
    
    def fetch_one(self, sql: str, parameters: tuple = ()) -> Optional[sqlite3.Row]:
        with self.get_cursor() as cursor:
            cursor.execute(sql, parameters)
            return cursor.fetchone()
    
    def fetch_all(self, sql: str, parameters: tuple = ()) -> List[sqlite3.Row]:
        with self.get_cursor() as cursor:
            cursor.execute(sql, parameters)
            return cursor.fetchall()
    
    def last_insert_id(self) -> int:
        with self.get_cursor() as cursor:
            return cursor.lastrowid


_db_manager: Optional[DatabaseManager] = None


def get_db() -> DatabaseManager:
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager
