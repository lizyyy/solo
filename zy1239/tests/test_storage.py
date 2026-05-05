"""Tests for the storage module."""

import os
import tempfile
from pathlib import Path

import pytest

from metaclass_analyzer.errors import DatabaseError
from metaclass_analyzer.models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)
from metaclass_analyzer.storage import SQLiteStorage


class TestSQLiteStorage:
    """Tests for SQLiteStorage."""

    def test_init_memory_db(self):
        """Test initializing in-memory database."""
        storage = SQLiteStorage(":memory:")
        assert storage.db_path == ":memory:"

    def test_init_file_db(self, temp_dir):
        """Test initializing file-based database."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        assert db_path.exists()

    def test_save_analysis(self, temp_dir, sample_analysis_result):
        """Test saving an analysis result."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        run_id = storage.save_analysis(sample_analysis_result)

        assert run_id == 1

    def test_get_latest_run(self, temp_dir, sample_analysis_result):
        """Test getting the latest run."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        assert storage.get_latest_run() is None

        storage.save_analysis(sample_analysis_result)
        latest = storage.get_latest_run()

        assert latest is not None
        assert latest["id"] == 1

    def test_get_run(self, temp_dir, sample_analysis_result):
        """Test getting a specific run."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        run_id = storage.save_analysis(sample_analysis_result)
        retrieved = storage.get_run(run_id)

        assert retrieved is not None
        assert len(retrieved.classes) == len(sample_analysis_result.classes)
        assert len(retrieved.timeline) == len(sample_analysis_result.timeline)

    def test_get_nonexistent_run(self, temp_dir):
        """Test getting a nonexistent run."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        assert storage.get_run(999) is None

    def test_list_runs(self, temp_dir, sample_analysis_result):
        """Test listing runs."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        assert len(storage.list_runs()) == 0

        storage.save_analysis(sample_analysis_result)
        storage.save_analysis(sample_analysis_result)

        runs = storage.list_runs()
        assert len(runs) == 2
        assert runs[0]["id"] == 2
        assert runs[1]["id"] == 1

    def test_list_runs_with_limit(self, temp_dir, sample_analysis_result):
        """Test listing runs with a limit."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        for _ in range(5):
            storage.save_analysis(sample_analysis_result)

        runs = storage.list_runs(limit=2)
        assert len(runs) == 2

    def test_get_class_timeline(self, temp_dir, sample_class_info, sample_events):
        """Test getting class timeline."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        result = AnalysisResult()
        result.classes[sample_class_info.name] = sample_class_info
        result.timeline = sample_events

        storage.save_analysis(result)

        events = storage.get_class_timeline(sample_class_info.name)
        assert len(events) == len(sample_events)

    def test_get_class_timeline_nonexistent(self, temp_dir):
        """Test getting timeline for nonexistent class."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        events = storage.get_class_timeline("NonexistentClass")
        assert len(events) == 0

    def test_search_classes(self, temp_dir, sample_class_info, sample_events):
        """Test searching for classes."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        result = AnalysisResult()
        result.classes[sample_class_info.name] = sample_class_info
        result.timeline = sample_events

        storage.save_analysis(result)

        matches = storage.search_classes("%Test%")
        assert len(matches) >= 1
        assert any(m["name"] == sample_class_info.name for m in matches)

    def test_search_classes_no_matches(self, temp_dir):
        """Test searching with no matches."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        matches = storage.search_classes("NonexistentPattern")
        assert len(matches) == 0

    def test_save_with_conflicts(self, temp_dir, sample_conflict):
        """Test saving analysis with conflicts."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        result = AnalysisResult()
        result.conflicts = [sample_conflict]

        run_id = storage.save_analysis(result)
        retrieved = storage.get_run(run_id)

        assert len(retrieved.conflicts) == 1
        assert retrieved.conflicts[0].class_name == sample_conflict.class_name

    def test_save_with_fields(self, temp_dir, sample_class_info):
        """Test saving analysis with fields."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        result = AnalysisResult()
        result.classes[sample_class_info.name] = sample_class_info

        run_id = storage.save_analysis(result)
        retrieved = storage.get_run(run_id)

        assert len(retrieved.classes[sample_class_info.name].fields) == len(sample_class_info.fields)

    def test_save_with_errors_warnings_suggestions(self, temp_dir):
        """Test saving analysis with errors, warnings, and suggestions."""
        db_path = temp_dir / "test.db"
        storage = SQLiteStorage(str(db_path))

        result = AnalysisResult()
        result.errors = ["Error 1", "Error 2"]
        result.warnings = ["Warning 1"]
        result.suggestions = ["Suggestion 1", "Suggestion 2", "Suggestion 3"]

        run_id = storage.save_analysis(result)
        retrieved = storage.get_run(run_id)

        assert len(retrieved.errors) == 2
        assert len(retrieved.warnings) == 1
        assert len(retrieved.suggestions) == 3
