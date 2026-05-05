import ast
import pytest

from asyncio_analyzer.database import Database
from asyncio_analyzer.analyzer import (
    BaseAnalyzer,
    EventLoopAnalyzer,
    CreateTaskLeakAnalyzer,
    GatherExceptionAnalyzer,
    QueueBackpressureAnalyzer,
)


class TestBaseAnalyzer:
    @pytest.fixture
    def db(self):
        db = Database(":memory:")
        db.init_schema()
        return db

    def test_add_issue(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        analyzer = BaseAnalyzer(db, run_id, {})
        analyzer.add_issue(
            issue_type='test_type',
            severity='high',
            title='Test Issue',
            description='Test description',
            snippet_file='test.py',
            snippet_line=10,
            task_id='task-1',
            suggestion='Fix it',
        )
        
        issues = db.get_all_issues(run_id)
        assert len(issues) == 1
        assert issues[0]['issue_type'] == 'test_type'
        assert issues[0]['severity'] == 'high'

    def test_add_blocking_point(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        analyzer = BaseAnalyzer(db, run_id, {})
        analyzer.add_blocking_point(
            snippet_file='test.py',
            snippet_line=5,
            operation='time.sleep()',
            duration=100.0,
            is_blocking=True,
        )
        
        blocking_points = db.get_blocking_points(run_id)
        assert len(blocking_points) == 1

    def test_add_leak_risk(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        analyzer = BaseAnalyzer(db, run_id, {})
        analyzer.add_leak_risk(
            risk_type='unmanaged_task',
            snippet_file='test.py',
            snippet_line=15,
            description='Test risk',
            risk_score=0.8,
        )
        
        leak_risks = db.get_leak_risks(run_id)
        assert len(leak_risks) == 1


class TestEventLoopAnalyzer:
    @pytest.fixture
    def db(self):
        db = Database(":memory:")
        db.init_schema()
        return db

    def test_detects_time_sleep(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio
import time

async def func():
    time.sleep(1)
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = EventLoopAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('time.sleep' in issue['title'] for issue in issues)

    def test_detects_requests(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio
import requests

async def func():
    response = requests.get("http://example.com")
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = EventLoopAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('requests' in issue['title'] for issue in issues)

    def test_detects_event_loop_blocked_event(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        events = [{
            'event_type': 'event_loop_blocked',
            'timestamp': '2024-01-01',
            'task_id': 'task-1',
            'duration_ms': 250,
        }]
        
        analyzer = EventLoopAnalyzer(db, run_id, {})
        analyzer.analyze([], events)
        
        issues = db.get_all_issues(run_id)
        assert any('事件循环阻塞' in issue['title'] for issue in issues)


class TestCreateTaskLeakAnalyzer:
    @pytest.fixture
    def db(self):
        db = Database(":memory:")
        db.init_schema()
        return db

    def test_detects_unmanaged_create_task(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def background():
    await asyncio.sleep(10)

async def main():
    asyncio.create_task(background())
    await asyncio.sleep(1)
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = CreateTaskLeakAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        leak_risks = db.get_leak_risks(run_id)
        
        assert any('未托管的 create_task' in issue['title'] for issue in issues)
        assert len(leak_risks) >= 1

    def test_detects_unused_task_variable(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def background():
    await asyncio.sleep(10)

async def main():
    task = asyncio.create_task(background())
    await asyncio.sleep(1)
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = CreateTaskLeakAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('任务变量未被使用' in issue['title'] for issue in issues)


class TestGatherExceptionAnalyzer:
    @pytest.fixture
    def db(self):
        db = Database(":memory:")
        db.init_schema()
        return db

    def test_detects_missing_return_exceptions(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def task():
    await asyncio.sleep(1)

async def main():
    results = await asyncio.gather(
        task(),
        task(),
    )
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = GatherExceptionAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('return_exceptions' in issue['title'] for issue in issues)


class TestQueueBackpressureAnalyzer:
    @pytest.fixture
    def db(self):
        db = Database(":memory:")
        db.init_schema()
        return db

    def test_detects_unbounded_queue(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def main():
    queue = asyncio.Queue()
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = QueueBackpressureAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('Queue 未设置 maxsize' in issue['title'] for issue in issues)

    def test_detects_maxsize_zero(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def main():
    queue = asyncio.Queue(maxsize=0)
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = QueueBackpressureAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('无界队列' in issue['title'] for issue in issues)

    def test_detects_put_nowait(self, db):
        run_id = "test-run"
        db.create_analysis_run(run_id)
        
        code = '''
import asyncio

async def producer(queue):
    queue.put_nowait("item")
'''
        snippet = {
            'name': 'test.py',
            'content': code,
            'ast': ast.parse(code),
            'lines': code.split('\n'),
        }
        
        analyzer = QueueBackpressureAnalyzer(db, run_id, {})
        analyzer.analyze([snippet], [])
        
        issues = db.get_all_issues(run_id)
        assert any('put_nowait' in issue['title'] for issue in issues)
