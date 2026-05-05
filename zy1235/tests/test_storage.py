"""Tests for storage modules."""

from datetime import datetime
from pathlib import Path

import pytest

from decorator_analyzer.models import (
    AnalysisResult,
    CallEvent,
    DecoratedFunction,
    DecoratorInfo,
    DecoratorType,
    FunctionMetadata,
    Risk,
    RiskLevel,
    RiskType,
)
from decorator_analyzer.storage import SQLiteStorage


class TestSQLiteStorage:
    """Tests for SQLiteStorage."""

    def test_create_database(self, tmp_path: Path) -> None:
        """Test creating a new database."""
        db_path = tmp_path / "test.db"
        assert not db_path.exists()
        
        storage = SQLiteStorage(db_path)
        
        assert db_path.exists()

    def test_save_and_load_analysis(self, tmp_path: Path) -> None:
        """Test saving and loading an analysis result."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=False,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        risk = Risk(
            id="risk1",
            function_id="func1",
            decorator_id="dec1",
            risk_type=RiskType.METADATA_LOSS,
            level=RiskLevel.MEDIUM,
            description="Test risk",
            location="test:10",
            suggestion="Test suggestion",
        )
        
        result = AnalysisResult(
            id="analysis1",
            timestamp=datetime.now(),
            decorated_functions=[decorated_func],
            call_events=[],
            risks=[risk],
            signature_checks=[],
            metadata_checks=[],
        )
        
        session_id = storage.save_analysis(result, "Test analysis")
        assert session_id == "analysis1"
        
        loaded = storage.load_analysis("analysis1")
        assert loaded is not None
        assert loaded.id == "analysis1"
        assert len(loaded.decorated_functions) == 1
        assert len(loaded.risks) == 1

    def test_list_sessions(self, tmp_path: Path) -> None:
        """Test listing analysis sessions."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        for i in range(5):
            result = AnalysisResult(
                id=f"analysis{i}",
                timestamp=datetime.now(),
                decorated_functions=[],
                call_events=[],
                risks=[],
                signature_checks=[],
                metadata_checks=[],
            )
            storage.save_analysis(result, f"Test {i}")
        
        sessions = storage.list_sessions(limit=3)
        assert len(sessions) == 3

    def test_get_session(self, tmp_path: Path) -> None:
        """Test getting a specific session."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        result = AnalysisResult(
            id="analysis1",
            timestamp=datetime.now(),
            decorated_functions=[],
            call_events=[],
            risks=[],
            signature_checks=[],
            metadata_checks=[],
        )
        storage.save_analysis(result, "Test description")
        
        session = storage.get_session("analysis1")
        assert session is not None
        assert session.id == "analysis1"
        assert session.description == "Test description"

    def test_get_nonexistent_session(self, tmp_path: Path) -> None:
        """Test getting a nonexistent session."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        session = storage.get_session("nonexistent")
        assert session is None

    def test_load_nonexistent_analysis(self, tmp_path: Path) -> None:
        """Test loading a nonexistent analysis."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        loaded = storage.load_analysis("nonexistent")
        assert loaded is None

    def test_save_with_call_events(self, tmp_path: Path) -> None:
        """Test saving and loading call events."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        result = AnalysisResult(
            id="analysis1",
            timestamp=datetime.now(),
            decorated_functions=[],
            call_events=[
                CallEvent(
                    id="event1",
                    function_id="func1",
                    timestamp=datetime.now(),
                    caller="main",
                    args=(),
                    kwargs={},
                    return_value=None,
                    exception=None,
                    decorator_stack=["timer"],
                    duration_ms=100.0,
                )
            ],
            risks=[],
            signature_checks=[],
            metadata_checks=[],
        )
        
        storage.save_analysis(result)
        
        loaded = storage.load_analysis("analysis1")
        assert loaded is not None
        assert len(loaded.call_events) == 1
        assert loaded.call_events[0].function_id == "func1"
        assert loaded.call_events[0].duration_ms == 100.0

    def test_save_multiple_decorators(self, tmp_path: Path) -> None:
        """Test saving and loading functions with multiple decorators."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorators = [
            DecoratorInfo(
                id="dec1",
                name="log_calls",
                decorator_type=DecoratorType.SIMPLE,
                module="test",
                line_number=5,
                has_wraps=True,
            ),
            DecoratorInfo(
                id="dec2",
                name="measure_time",
                decorator_type=DecoratorType.SIMPLE,
                module="test",
                line_number=15,
                has_wraps=True,
            ),
        ]
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=decorators,
            decorator_order=["dec1", "dec2"],
        )
        
        result = AnalysisResult(
            id="analysis1",
            timestamp=datetime.now(),
            decorated_functions=[decorated_func],
            call_events=[],
            risks=[],
            signature_checks=[],
            metadata_checks=[],
        )
        
        storage.save_analysis(result)
        
        loaded = storage.load_analysis("analysis1")
        assert loaded is not None
        assert len(loaded.decorated_functions) == 1
        assert len(loaded.decorated_functions[0].decorators) == 2
        assert loaded.decorated_functions[0].decorator_order == ["dec1", "dec2"]

    def test_session_counts(self, tmp_path: Path) -> None:
        """Test that session counts are correctly stored."""
        db_path = tmp_path / "test.db"
        storage = SQLiteStorage(db_path)
        
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=False,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        risk = Risk(
            id="risk1",
            function_id="func1",
            decorator_id="dec1",
            risk_type=RiskType.METADATA_LOSS,
            level=RiskLevel.MEDIUM,
            description="Test risk",
            location="test:10",
            suggestion="Test suggestion",
        )
        
        result = AnalysisResult(
            id="analysis1",
            timestamp=datetime.now(),
            decorated_functions=[decorated_func],
            call_events=[
                CallEvent(
                    id="event1",
                    function_id="func1",
                    timestamp=datetime.now(),
                    caller="main",
                    args=(),
                    kwargs={},
                    return_value=None,
                    exception=None,
                    decorator_stack=[],
                    duration_ms=0.0,
                )
            ],
            risks=[risk],
            signature_checks=[],
            metadata_checks=[],
        )
        
        storage.save_analysis(result, "Test description")
        
        session = storage.get_session("analysis1")
        assert session is not None
        assert session.func_count == 1
        assert session.event_count == 1
        assert session.risk_count == 1
