"""测试 SQLite 存储层"""

from datetime import datetime
from pathlib import Path

import pytest

from magic_method_analyzer.models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)
from magic_method_analyzer.storage import SQLiteStorage


class TestSQLiteStorage:
    """测试 SQLite 存储"""

    def test_init_db(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        assert db_path.exists()

    def test_save_and_get_session(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        session = AnalysisSession(
            session_id="test_session_001",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            end_time=datetime(2026, 5, 5, 10, 0, 5),
            source_files=["test.yaml", "test.jsonl"],
            metadata={"version": "1.0"},
        )
        
        session.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime(2026, 5, 5, 10, 0, 1),
            caller="test",
            target="obj1",
            args=("attr",),
            kwargs={},
            result="value",
        ))
        
        session.issues.append(Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.WARNING,
            title="测试问题",
            description="测试描述",
            location="TestClass",
            suggestion="测试建议",
        ))
        
        storage.save_session(session)
        
        loaded = storage.get_session("test_session_001")
        
        assert loaded is not None
        assert loaded.session_id == "test_session_001"
        assert len(loaded.source_files) == 2
        assert loaded.metadata["version"] == "1.0"

    def test_get_nonexistent_session(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        loaded = storage.get_session("nonexistent")
        assert loaded is None

    def test_get_all_sessions(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        for i in range(3):
            session = AnalysisSession(
                session_id=f"session_{i:03d}",
                start_time=datetime(2026, 5, 5, 10, 0, i),
                source_files=[f"file_{i}.yaml"],
            )
            storage.save_session(session)
        
        sessions = storage.get_all_sessions()
        
        assert len(sessions) == 3
        session_ids = [s.session_id for s in sessions]
        assert "session_000" in session_ids
        assert "session_001" in session_ids
        assert "session_002" in session_ids

    def test_delete_session(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        session = AnalysisSession(
            session_id="to_delete",
            start_time=datetime.now(),
        )
        storage.save_session(session)
        
        assert storage.get_session("to_delete") is not None
        
        result = storage.delete_session("to_delete")
        
        assert result is True
        assert storage.get_session("to_delete") is None

    def test_delete_nonexistent_session(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        result = storage.delete_session("nonexistent")
        assert result is False

    def test_get_statistics(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        session1 = AnalysisSession(
            session_id="session1",
            start_time=datetime.now(),
        )
        session1.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime.now(),
            caller="test",
            target="obj",
            args=("a",),
            kwargs={},
        ))
        session1.issues.append(Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.CRITICAL,
            title="问题1",
            description="",
            location="",
        ))
        storage.save_session(session1)
        
        session2 = AnalysisSession(
            session_id="session2",
            start_time=datetime.now(),
        )
        session2.issues.append(Issue(
            issue_type=IssueType.EXCEPTION_OVERRIDE,
            severity=IssueSeverity.WARNING,
            title="问题2",
            description="",
            location="",
        ))
        storage.save_session(session2)
        
        stats = storage.get_statistics()
        
        assert stats["sessions_count"] == 2
        assert stats["method_calls_count"] == 1
        assert stats["issues_count"] == 2
        assert stats["issues_by_severity"]["严重"] == 1
        assert stats["issues_by_severity"]["警告"] == 1

    def test_update_existing_session(self, tmp_path: Path):
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        session = AnalysisSession(
            session_id="update_test",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            source_files=["initial.yaml"],
        )
        storage.save_session(session)
        
        session.end_time = datetime(2026, 5, 5, 10, 0, 10)
        session.source_files = ["updated.yaml", "added.jsonl"]
        session.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.SETATTR,
            timestamp=datetime.now(),
            caller="test",
            target="obj",
            args=("a", 1),
            kwargs={},
        ))
        storage.save_session(session)
        
        loaded = storage.get_session("update_test")
        assert loaded is not None
        assert loaded.end_time is not None
        assert len(loaded.source_files) == 2
        assert "updated.yaml" in loaded.source_files
        assert len(loaded.method_calls) == 1
