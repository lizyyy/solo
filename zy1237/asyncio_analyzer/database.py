import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any


class Database:
    def __init__(self, db_path: str = ":memory:"):
        self.db_path = db_path
        self._conn = None

    def connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(self.db_path)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def close(self):
        if self._conn:
            self._conn.close()
            self._conn = None

    def init_schema(self):
        conn = self.connect()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analysis_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT UNIQUE NOT NULL,
                timestamp TEXT NOT NULL,
                samples_dir TEXT,
                config TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                name TEXT,
                coroutine_name TEXT,
                created_at TEXT,
                started_at TEXT,
                finished_at TEXT,
                status TEXT,
                parent_task_id TEXT,
                snippet_file TEXT,
                snippet_line INTEGER,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                task_id TEXT,
                data TEXT,
                snippet_file TEXT,
                snippet_line INTEGER,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                issue_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                snippet_file TEXT,
                snippet_line INTEGER,
                task_id TEXT,
                suggestion TEXT,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS timeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                event_type TEXT NOT NULL,
                task_id TEXT,
                details TEXT,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS blocking_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                task_id TEXT,
                snippet_file TEXT NOT NULL,
                snippet_line INTEGER NOT NULL,
                operation TEXT NOT NULL,
                duration REAL,
                is_blocking BOOLEAN,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS leak_risks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                task_id TEXT,
                risk_type TEXT NOT NULL,
                snippet_file TEXT NOT NULL,
                snippet_line INTEGER NOT NULL,
                description TEXT,
                risk_score REAL,
                FOREIGN KEY (run_id) REFERENCES analysis_runs(run_id)
            )
        ''')

        cursor.execute('CREATE INDEX IF NOT EXISTS idx_tasks_run_id ON tasks(run_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_issues_run_id ON issues(run_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timeline_run_id ON timeline(run_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_blocking_points_run_id ON blocking_points(run_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_leak_risks_run_id ON leak_risks(run_id)')

        conn.commit()

    def create_analysis_run(self, run_id: str, samples_dir: str = None, config: Dict = None) -> int:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO analysis_runs (run_id, timestamp, samples_dir, config)
            VALUES (?, ?, ?, ?)
        ''', (run_id, datetime.now().isoformat(), samples_dir, json.dumps(config or {})))
        conn.commit()
        return cursor.lastrowid

    def insert_task(self, run_id: str, task_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tasks (
                run_id, task_id, name, coroutine_name, created_at,
                started_at, finished_at, status, parent_task_id,
                snippet_file, snippet_line
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            run_id,
            task_data.get('task_id'),
            task_data.get('name'),
            task_data.get('coroutine_name'),
            task_data.get('created_at'),
            task_data.get('started_at'),
            task_data.get('finished_at'),
            task_data.get('status'),
            task_data.get('parent_task_id'),
            task_data.get('snippet_file'),
            task_data.get('snippet_line'),
        ))
        conn.commit()

    def insert_event(self, run_id: str, event_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO events (
                run_id, event_type, timestamp, task_id, data, snippet_file, snippet_line
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            run_id,
            event_data.get('event_type'),
            event_data.get('timestamp'),
            event_data.get('task_id'),
            json.dumps(event_data.get('data', {})),
            event_data.get('snippet_file'),
            event_data.get('snippet_line'),
        ))
        conn.commit()

    def insert_issue(self, run_id: str, issue_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO issues (
                run_id, issue_type, severity, title, description,
                snippet_file, snippet_line, task_id, suggestion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            run_id,
            issue_data.get('issue_type'),
            issue_data.get('severity'),
            issue_data.get('title'),
            issue_data.get('description'),
            issue_data.get('snippet_file'),
            issue_data.get('snippet_line'),
            issue_data.get('task_id'),
            issue_data.get('suggestion'),
        ))
        conn.commit()

    def insert_timeline(self, run_id: str, timeline_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO timeline (run_id, timestamp, event_type, task_id, details)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            run_id,
            timeline_data.get('timestamp'),
            timeline_data.get('event_type'),
            timeline_data.get('task_id'),
            json.dumps(timeline_data.get('details', {})),
        ))
        conn.commit()

    def insert_blocking_point(self, run_id: str, blocking_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO blocking_points (
                run_id, task_id, snippet_file, snippet_line, operation, duration, is_blocking
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            run_id,
            blocking_data.get('task_id'),
            blocking_data.get('snippet_file'),
            blocking_data.get('snippet_line'),
            blocking_data.get('operation'),
            blocking_data.get('duration'),
            blocking_data.get('is_blocking', False),
        ))
        conn.commit()

    def insert_leak_risk(self, run_id: str, risk_data: Dict[str, Any]):
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO leak_risks (
                run_id, task_id, risk_type, snippet_file, snippet_line, description, risk_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            run_id,
            risk_data.get('task_id'),
            risk_data.get('risk_type'),
            risk_data.get('snippet_file'),
            risk_data.get('snippet_line'),
            risk_data.get('description'),
            risk_data.get('risk_score'),
        ))
        conn.commit()

    def get_all_issues(self, run_id: str) -> List[sqlite3.Row]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM issues WHERE run_id = ? ORDER BY severity DESC', (run_id,))
        return cursor.fetchall()

    def get_timeline(self, run_id: str) -> List[sqlite3.Row]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM timeline WHERE run_id = ? ORDER BY timestamp', (run_id,))
        return cursor.fetchall()

    def get_blocking_points(self, run_id: str) -> List[sqlite3.Row]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM blocking_points WHERE run_id = ? AND is_blocking = 1', (run_id,))
        return cursor.fetchall()

    def get_leak_risks(self, run_id: str) -> List[sqlite3.Row]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM leak_risks WHERE run_id = ? ORDER BY risk_score DESC', (run_id,))
        return cursor.fetchall()

    def get_latest_run_id(self) -> Optional[str]:
        conn = self.connect()
        cursor = conn.cursor()
        cursor.execute('SELECT run_id FROM analysis_runs ORDER BY id DESC LIMIT 1')
        row = cursor.fetchone()
        return row['run_id'] if row else None
