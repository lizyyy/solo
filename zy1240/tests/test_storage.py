"""Tests for storage module."""

import os
import tempfile
from datetime import datetime

import pytest

from descriptor_inspector.models import (
    AnalysisResult,
    ComparisonResult,
    DescriptorCase,
    DescriptorType,
    Event,
    EventType,
)
from descriptor_inspector.storage import StorageManager


class TestStorageManager:
    """Tests for StorageManager class."""

    def setup_method(self):
        """Set up test fixture with temporary database."""
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test.db")
        self.storage = StorageManager(self.db_path)

    def teardown_method(self):
        """Clean up test fixture."""
        if os.path.exists(self.db_path):
            os.remove(self.db_path)
        os.rmdir(self.temp_dir)

    def test_init_db(self):
        """Test that database is initialized with correct schema."""
        assert os.path.exists(self.db_path)

        with self.storage.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = {row[0] for row in cursor.fetchall()}

            assert "schema_version" in tables
            assert "descriptor_cases" in tables
            assert "events" in tables
            assert "analysis_results" in tables
            assert "comparison_results" in tables

    def test_save_and_get_descriptor_case(self):
        """Test saving and retrieving a descriptor case."""
        case = DescriptorCase(
            id="test_01",
            name="Test Case",
            description="A test descriptor case",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            code_snippet="class Test:\n    pass",
            expected_behavior={"priority": "high"},
            tags=["test", "data_descriptor"],
        )

        self.storage.save_descriptor_case(case)
        retrieved = self.storage.get_descriptor_case("test_01")

        assert retrieved is not None
        assert retrieved.id == "test_01"
        assert retrieved.name == "Test Case"
        assert retrieved.descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert retrieved.tags == ["test", "data_descriptor"]

    def test_get_all_descriptor_cases(self):
        """Test retrieving all descriptor cases."""
        cases = [
            DescriptorCase(
                id=f"test_{i}",
                name=f"Test Case {i}",
                description=f"Test case {i}",
                descriptor_type=DescriptorType.DATA_DESCRIPTOR,
                code_snippet="",
                expected_behavior={},
            )
            for i in range(3)
        ]

        for case in cases:
            self.storage.save_descriptor_case(case)

        retrieved = self.storage.get_all_descriptor_cases()

        assert len(retrieved) == 3
        assert {c.id for c in retrieved} == {"test_0", "test_1", "test_2"}

    def test_save_and_get_event(self):
        """Test saving and retrieving events."""
        event = Event(
            id=1,
            timestamp=datetime.now(),
            event_type=EventType.GET,
            descriptor_name="TestDescriptor",
            instance_type="MyClass",
            owner_class="MyClass",
            value=42,
            context={"line": 10},
        )

        self.storage.save_event(event, case_id="test_01")
        events = self.storage.get_events_by_case("test_01")

        assert len(events) == 1
        assert events[0].event_type == EventType.GET
        assert events[0].value == 42

    def test_save_and_get_analysis_result(self):
        """Test saving and retrieving an analysis result."""
        result = AnalysisResult(
            case_id="test_01",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            events=[],
            priority_observed="data_descriptor_priority",
            instance_dict_coverage=False,
            get_called=True,
            set_called=True,
            delete_called=False,
            set_name_called=False,
            validation_errors=[],
            metadata={"source": "test"},
        )

        result_id = self.storage.save_analysis_result(result)
        retrieved = self.storage.get_analysis_result(result_id)

        assert retrieved is not None
        assert retrieved.case_id == "test_01"
        assert retrieved.descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert retrieved.get_called is True
        assert retrieved.metadata == {"source": "test"}

    def test_get_latest_analysis_for_case(self):
        """Test retrieving the latest analysis for a case."""
        from datetime import timedelta

        result1 = AnalysisResult(
            case_id="test_01",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            events=[],
            priority_observed="data_descriptor_priority",
            instance_dict_coverage=False,
            get_called=True,
            set_called=False,
            delete_called=False,
            set_name_called=False,
            validation_errors=[],
            analyzed_at=datetime.now() - timedelta(hours=1),
        )

        result2 = AnalysisResult(
            case_id="test_01",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            events=[],
            priority_observed="data_descriptor_priority",
            instance_dict_coverage=False,
            get_called=True,
            set_called=True,
            delete_called=False,
            set_name_called=False,
            validation_errors=[],
            analyzed_at=datetime.now(),
        )

        self.storage.save_analysis_result(result1)
        self.storage.save_analysis_result(result2)

        latest = self.storage.get_latest_analysis_for_case("test_01")

        assert latest is not None
        assert latest.set_called is True

    def test_save_and_get_comparison_result(self):
        """Test saving and retrieving a comparison result."""
        comparison = ComparisonResult(
            case1_id="case1",
            case2_id="case2",
            differences=[{"field": "type", "case1": "A", "case2": "B"}],
            similarities=[{"field": "get_called", "value": True}],
            key_insights=["Case A is different from Case B"],
        )

        comparison_id = self.storage.save_comparison_result(comparison)
        retrieved = self.storage.get_comparison_result(comparison_id)

        assert retrieved is not None
        assert retrieved.case1_id == "case1"
        assert retrieved.case2_id == "case2"
        assert len(retrieved.differences) == 1
        assert len(retrieved.key_insights) == 1

    def test_get_comparisons_between(self):
        """Test retrieving comparisons between two cases."""
        comparison1 = ComparisonResult(
            case1_id="case1",
            case2_id="case2",
            differences=[],
            similarities=[],
            key_insights=[],
        )

        comparison2 = ComparisonResult(
            case1_id="case2",
            case2_id="case1",
            differences=[],
            similarities=[],
            key_insights=[],
        )

        self.storage.save_comparison_result(comparison1)
        self.storage.save_comparison_result(comparison2)

        comparisons = self.storage.get_comparisons_between("case1", "case2")

        assert len(comparisons) == 2

    def test_get_statistics(self):
        """Test retrieving database statistics."""
        case1 = DescriptorCase(
            id="test_01",
            name="Test 1",
            description="",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            code_snippet="",
            expected_behavior={},
        )

        case2 = DescriptorCase(
            id="test_02",
            name="Test 2",
            description="",
            descriptor_type=DescriptorType.NON_DATA_DESCRIPTOR,
            code_snippet="",
            expected_behavior={},
        )

        self.storage.save_descriptor_case(case1)
        self.storage.save_descriptor_case(case2)

        stats = self.storage.get_statistics()

        assert stats["case_count"] == 2
        assert "data_descriptor" in stats["type_distribution"]
        assert "non_data_descriptor" in stats["type_distribution"]

    def test_get_nonexistent_case(self):
        """Test that getting a nonexistent case returns None."""
        case = self.storage.get_descriptor_case("nonexistent")
        assert case is None

    def test_get_nonexistent_analysis(self):
        """Test that getting a nonexistent analysis returns None."""
        analysis = self.storage.get_analysis_result(9999)
        assert analysis is None

    def test_get_nonexistent_comparison(self):
        """Test that getting a nonexistent comparison returns None."""
        comparison = self.storage.get_comparison_result(9999)
        assert comparison is None
