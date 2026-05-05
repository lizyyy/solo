import pytest
import tempfile
import os
from pathlib import Path

from asyncio_analyzer.database import Database


class TestDatabase:
    @pytest.fixture
    def temp_db(self):
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        try:
            yield db_path
        finally:
            if os.path.exists(db_path):
                os.unlink(db_path)

    def test_init_schema(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        conn = db.connect()
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        required_tables = [
            'analysis_runs', 'tasks', 'events', 'issues',
            'timeline', 'blocking_points', 'leak_risks'
        ]
        
        for table in required_tables:
            assert table in tables, f"Table {table} should exist"

    def test_create_analysis_run(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        run_id = "test-run-001"
        row_id = db.create_analysis_run(run_id, "./samples", {"key": "value"})
        
        assert row_id > 0
        
        conn = db.connect()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM analysis_runs WHERE run_id = ?", (run_id,))
        row = cursor.fetchone()
        
        assert row is not None
        assert row['run_id'] == run_id
        assert row['samples_dir'] == "./samples"

    def test_insert_issue(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        run_id = "test-run-001"
        db.create_analysis_run(run_id)
        
        db.insert_issue(run_id, {
            'issue_type': 'event_loop_blocking',
            'severity': 'high',
            'title': 'Test issue',
            'description': 'Test description',
            'snippet_file': 'test.py',
            'snippet_line': 10,
            'task_id': 'task-001',
            'suggestion': 'Fix it',
        })
        
        issues = db.get_all_issues(run_id)
        assert len(issues) == 1
        assert issues[0]['title'] == 'Test issue'
        assert issues[0]['severity'] == 'high'

    def test_insert_blocking_point(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        run_id = "test-run-001"
        db.create_analysis_run(run_id)
        
        db.insert_blocking_point(run_id, {
            'task_id': 'task-001',
            'snippet_file': 'test.py',
            'snippet_line': 5,
            'operation': 'time.sleep()',
            'duration': 100.5,
            'is_blocking': True,
        })
        
        blocking_points = db.get_blocking_points(run_id)
        assert len(blocking_points) == 1
        assert blocking_points[0]['operation'] == 'time.sleep()'

    def test_insert_leak_risk(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        run_id = "test-run-001"
        db.create_analysis_run(run_id)
        
        db.insert_leak_risk(run_id, {
            'task_id': 'task-001',
            'risk_type': 'unmanaged_task',
            'snippet_file': 'test.py',
            'snippet_line': 15,
            'description': 'create_task not awaited',
            'risk_score': 0.9,
        })
        
        leak_risks = db.get_leak_risks(run_id)
        assert len(leak_risks) == 1
        assert leak_risks[0]['risk_score'] == 0.9

    def test_get_latest_run_id(self, temp_db):
        db = Database(temp_db)
        db.init_schema()
        
        assert db.get_latest_run_id() is None
        
        db.create_analysis_run("run-1")
        db.create_analysis_run("run-2")
        db.create_analysis_run("run-3")
        
        assert db.get_latest_run_id() == "run-3"

    def test_in_memory_database(self):
        db = Database(":memory:")
        db.init_schema()
        
        run_id = "test-run"
        db.create_analysis_run(run_id)
        db.insert_issue(run_id, {
            'issue_type': 'test',
            'severity': 'low',
            'title': 'Test',
        })
        
        issues = db.get_all_issues(run_id)
        assert len(issues) == 1
