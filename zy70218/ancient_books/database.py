import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Database:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self._ensure_initialized()
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def _ensure_initialized(self):
        if self.db_path.exists():
            return
        
        with self.get_connection() as conn:
            self._create_tables(conn)
    
    def _create_tables(self, conn):
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE scan_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_dir TEXT NOT NULL,
            scan_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            total_files INTEGER DEFAULT 0,
            parsed_files INTEGER DEFAULT 0,
            failed_files INTEGER DEFAULT 0
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE scanned_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER,
            modification_time TIMESTAMP,
            volume_number INTEGER,
            page_number INTEGER,
            file_extension TEXT,
            parse_status TEXT NOT NULL DEFAULT 'pending',
            parse_error TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES scan_sessions(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE check_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            description TEXT
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE volumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            check_run_id INTEGER NOT NULL,
            volume_number INTEGER NOT NULL,
            expected_start_page INTEGER DEFAULT 1,
            expected_end_page INTEGER,
            actual_start_page INTEGER,
            actual_end_page INTEGER,
            expected_page_count INTEGER,
            actual_page_count INTEGER,
            status TEXT NOT NULL DEFAULT 'pending',
            FOREIGN KEY (check_run_id) REFERENCES check_runs(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE page_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            check_run_id INTEGER NOT NULL,
            volume_number INTEGER NOT NULL,
            page_number INTEGER NOT NULL,
            file_path TEXT,
            status TEXT NOT NULL,
            issues TEXT,
            FOREIGN KEY (check_run_id) REFERENCES check_runs(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE exceptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            check_run_id INTEGER,
            exception_type TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'error',
            title TEXT NOT NULL,
            description TEXT,
            source_type TEXT,
            source_reference TEXT,
            source_data TEXT,
            resolved INTEGER DEFAULT 0,
            resolved_at TIMESTAMP,
            resolved_by TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            change_reason TEXT,
            changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            changed_by TEXT DEFAULT 'system'
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE manual_fixes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            original_volume INTEGER,
            original_page INTEGER,
            corrected_volume INTEGER,
            corrected_page INTEGER,
            fix_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('CREATE INDEX idx_scanned_files_session ON scanned_files(session_id)')
        cursor.execute('CREATE INDEX idx_scanned_files_volume_page ON scanned_files(volume_number, page_number)')
        cursor.execute('CREATE INDEX idx_volumes_check_run ON volumes(check_run_id)')
        cursor.execute('CREATE INDEX idx_page_checks_check_run ON page_checks(check_run_id)')
        cursor.execute('CREATE INDEX idx_exceptions_type ON exceptions(exception_type)')
        cursor.execute('CREATE INDEX idx_exceptions_resolved ON exceptions(resolved)')
        cursor.execute('CREATE INDEX idx_revisions_entity ON revisions(entity_type, entity_id)')
