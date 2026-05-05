"""Tests for models module."""

from datetime import datetime

import pytest

from descriptor_inspector.models import (
    AnalysisResult,
    ComparisonResult,
    DescriptorCase,
    DescriptorType,
    Event,
    EventType,
    ValidationError,
)


class TestDescriptorType:
    """Tests for DescriptorType enum."""

    def test_descriptor_type_values(self):
        """Test that all descriptor types have correct values."""
        assert DescriptorType.DATA_DESCRIPTOR.value == "data_descriptor"
        assert DescriptorType.NON_DATA_DESCRIPTOR.value == "non_data_descriptor"
        assert DescriptorType.PROPERTY.value == "property"
        assert DescriptorType.CACHED_PROPERTY.value == "cached_property"
        assert DescriptorType.NOT_A_DESCRIPTOR.value == "not_a_descriptor"

    def test_descriptor_type_from_string(self):
        """Test creating DescriptorType from string."""
        assert DescriptorType("data_descriptor") == DescriptorType.DATA_DESCRIPTOR
        assert DescriptorType("property") == DescriptorType.PROPERTY

    def test_invalid_descriptor_type(self):
        """Test that invalid descriptor type raises ValueError."""
        with pytest.raises(ValueError):
            DescriptorType("invalid_type")


class TestEventType:
    """Tests for EventType enum."""

    def test_event_type_values(self):
        """Test that all event types have correct values."""
        assert EventType.GET.value == "__get__"
        assert EventType.SET.value == "__set__"
        assert EventType.DELETE.value == "__delete__"
        assert EventType.SET_NAME.value == "__set_name__"
        assert EventType.INSTANCE_DICT_ACCESS.value == "instance_dict_access"
        assert EventType.VALIDATION_ERROR.value == "validation_error"
        assert EventType.ATTRIBUTE_ERROR.value == "attribute_error"


class TestDescriptorCase:
    """Tests for DescriptorCase dataclass."""

    def test_create_descriptor_case(self):
        """Test creating a DescriptorCase instance."""
        case = DescriptorCase(
            id="test_01",
            name="Test Case",
            description="A test descriptor case",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            code_snippet="class Test:\n    pass",
            expected_behavior={"priority": "high"},
            tags=["test", "data_descriptor"],
        )

        assert case.id == "test_01"
        assert case.name == "Test Case"
        assert case.descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert "test" in case.tags
        assert isinstance(case.created_at, datetime)

    def test_descriptor_case_defaults(self):
        """Test default values for DescriptorCase."""
        case = DescriptorCase(
            id="test_01",
            name="Test",
            description="",
            descriptor_type=DescriptorType.NOT_A_DESCRIPTOR,
            code_snippet="",
            expected_behavior={},
        )

        assert case.tags == []
        assert case.created_at is not None


class TestEvent:
    """Tests for Event dataclass."""

    def test_create_event(self):
        """Test creating an Event instance."""
        event = Event(
            id=1,
            timestamp=datetime.now(),
            event_type=EventType.GET,
            descriptor_name="TestDescriptor",
            instance_type="MyClass",
            owner_class="MyClass",
            value=42,
            exception=None,
            call_stack=["func1", "func2"],
            context={"line": 10},
        )

        assert event.id == 1
        assert event.event_type == EventType.GET
        assert event.value == 42
        assert event.context == {"line": 10}


class TestAnalysisResult:
    """Tests for AnalysisResult dataclass."""

    def test_create_analysis_result(self):
        """Test creating an AnalysisResult instance."""
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

        assert result.case_id == "test_01"
        assert result.descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert result.priority_observed == "data_descriptor_priority"
        assert result.get_called is True
        assert result.set_name_called is False


class TestComparisonResult:
    """Tests for ComparisonResult dataclass."""

    def test_create_comparison_result(self):
        """Test creating a ComparisonResult instance."""
        comparison = ComparisonResult(
            case1_id="case1",
            case2_id="case2",
            differences=[{"field": "type", "case1": "A", "case2": "B"}],
            similarities=[{"field": "get_called", "value": True}],
            key_insights=["Case A is different from Case B"],
        )

        assert comparison.case1_id == "case1"
        assert comparison.case2_id == "case2"
        assert len(comparison.differences) == 1
        assert len(comparison.similarities) == 1
        assert len(comparison.key_insights) == 1


class TestValidationError:
    """Tests for ValidationError dataclass."""

    def test_create_validation_error(self):
        """Test creating a ValidationError instance."""
        error = ValidationError(
            file_path="test.yaml",
            line_number=10,
            error_type="YAMLError",
            message="Invalid YAML syntax",
            suggestion="Check for missing colon",
            context="  - invalid: yaml",
        )

        assert error.file_path == "test.yaml"
        assert error.line_number == 10
        assert error.error_type == "YAMLError"
        assert error.message == "Invalid YAML syntax"
        assert error.suggestion == "Check for missing colon"
