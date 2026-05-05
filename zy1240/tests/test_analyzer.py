"""Tests for analyzer module."""

import pytest

from descriptor_inspector.analyzer import DescriptorAnalyzer
from descriptor_inspector.models import DescriptorType, EventType


class TestDescriptorAnalyzer:
    """Tests for DescriptorAnalyzer class."""

    def setup_method(self):
        """Set up test fixture."""
        self.analyzer = DescriptorAnalyzer()

    def test_analyze_data_descriptor(self):
        """Test analyzing a data descriptor."""
        code = """
class DataDescriptor:
    def __get__(self, instance, owner):
        return instance._value
    
    def __set__(self, instance, value):
        instance._value = value
    
    def __delete__(self, instance):
        del instance._value

class MyClass:
    value = DataDescriptor()
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert result.priority_observed == "data_descriptor_priority"
        assert result.get_called is True
        assert result.set_called is True
        assert result.delete_called is True

    def test_analyze_non_data_descriptor(self):
        """Test analyzing a non-data descriptor."""
        code = """
class NonDataDescriptor:
    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__.get('value', 'default')

class MyClass:
    value = NonDataDescriptor()
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.descriptor_type == DescriptorType.NON_DATA_DESCRIPTOR
        assert result.priority_observed == "instance_dict_priority"
        assert result.get_called is True
        assert result.set_called is False

    def test_analyze_property_decorator(self):
        """Test analyzing code with @property decorator."""
        code = """
class MyClass:
    def __init__(self):
        self._value = 0
    
    @property
    def value(self):
        return self._value
    
    @value.setter
    def value(self, val):
        self._value = val
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.descriptor_type == DescriptorType.PROPERTY
        assert result.priority_observed == "data_descriptor_priority"
        assert result.get_called is True

    def test_analyze_cached_property(self):
        """Test analyzing code with cached_property."""
        code = """
from functools import cached_property

class MyClass:
    def __init__(self, data):
        self._data = data
    
    @cached_property
    def processed(self):
        return sum(self._data)
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.descriptor_type == DescriptorType.CACHED_PROPERTY
        assert result.priority_observed == "instance_dict_priority"
        assert result.property_vs_cached_diff is not None

    def test_analyze_set_name(self):
        """Test analyzing code with __set_name__."""
        code = """
class ValidatedDescriptor:
    def __get__(self, instance, owner):
        return instance.__dict__.get(self.name, 0)
    
    def __set__(self, instance, value):
        instance.__dict__[self.name] = value
    
    def __set_name__(self, owner, name):
        self.name = name

class MyClass:
    score = ValidatedDescriptor()
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.set_name_called is True
        assert result.descriptor_type == DescriptorType.DATA_DESCRIPTOR

    def test_analyze_instance_dict_coverage(self):
        """Test analyzing code that accesses instance __dict__."""
        code = """
class NonDataDescriptor:
    def __get__(self, instance, owner):
        return instance.__dict__.get('value', 'default')

class MyClass:
    value = NonDataDescriptor()

obj = MyClass()
obj.__dict__['value'] = 'override'
print(obj.value)
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert result.instance_dict_coverage is True

    def test_analyze_validation_error(self):
        """Test analyzing code with validation errors."""
        code = """
class ValidatedDescriptor:
    def __set__(self, instance, value):
        if value < 0:
            raise ValueError("Value must be non-negative")
        instance._value = value

class MyClass:
    value = ValidatedDescriptor()

obj = MyClass()
try:
    obj.value = -1
except ValueError as e:
    print(f"Error: {e}")
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert len(result.validation_errors) == 0

    def test_analyze_syntax_error(self):
        """Test analyzing code with syntax errors."""
        code = """
class InvalidSyntax
    def __get__(self, instance, owner):
        return 42
"""
        result = self.analyzer.analyze_code_snippet(code, "test_case")

        assert len(result.validation_errors) > 0
        assert result.priority_observed == "error"

    def test_compare_results(self):
        """Test comparing two analysis results."""
        from descriptor_inspector.models import AnalysisResult, DescriptorType

        result1 = AnalysisResult(
            case_id="case1",
            descriptor_type=DescriptorType.DATA_DESCRIPTOR,
            events=[],
            priority_observed="data_descriptor_priority",
            instance_dict_coverage=False,
            get_called=True,
            set_called=True,
            delete_called=False,
            set_name_called=False,
            validation_errors=[],
        )

        result2 = AnalysisResult(
            case_id="case2",
            descriptor_type=DescriptorType.NON_DATA_DESCRIPTOR,
            events=[],
            priority_observed="instance_dict_priority",
            instance_dict_coverage=True,
            get_called=True,
            set_called=False,
            delete_called=False,
            set_name_called=False,
            validation_errors=[],
        )

        comparison = self.analyzer.compare_results(result1, result2)

        assert comparison.case1_id == "case1"
        assert comparison.case2_id == "case2"
        assert len(comparison.differences) > 0
        assert len(comparison.key_insights) > 0

    def test_parse_descriptor_cases(self):
        """Test parsing descriptor cases from YAML."""
        yaml_content = """
cases:
  - id: test_01
    name: Test Case 1
    description: A test case
    descriptor_type: data_descriptor
    tags:
      - test
    code_snippet: |
      class Test:
          pass
    expected_behavior:
      priority: high
"""
        cases = self.analyzer.parse_descriptor_cases(yaml_content)

        assert len(cases) == 1
        assert cases[0].id == "test_01"
        assert cases[0].descriptor_type == DescriptorType.DATA_DESCRIPTOR
        assert "test" in cases[0].tags

    def test_parse_invalid_yaml(self):
        """Test parsing invalid YAML."""
        yaml_content = """
cases:
  - id: test_01
    name: [Invalid YAML
"""
        cases = self.analyzer.parse_descriptor_cases(yaml_content)

        assert len(cases) == 0
        assert len(self.analyzer.validation_errors) > 0

    def test_parse_events_jsonl(self):
        """Test parsing events from JSONL."""
        jsonl_content = '''{"id": 1, "timestamp": "2026-05-05T10:00:00", "event_type": "__get__", "descriptor_name": "Test", "instance_type": "MyClass", "owner_class": "MyClass"}
{"id": 2, "timestamp": "2026-05-05T10:00:01", "event_type": "__set__", "descriptor_name": "Test", "instance_type": "MyClass", "owner_class": "MyClass", "value": 42}
'''
        events = self.analyzer.parse_events_jsonl(jsonl_content)

        assert len(events) == 2
        assert events[0].event_type == EventType.GET
        assert events[1].event_type == EventType.SET
        assert events[1].value == 42

    def test_parse_invalid_jsonl(self):
        """Test parsing invalid JSONL."""
        jsonl_content = '''{"id": 1, "timestamp": "2026-05-05T10:00:00", "event_type": "__get__"}
invalid json line
{"id": 2, "timestamp": "2026-05-05T10:00:01", "event_type": "__set__"}
'''
        events = self.analyzer.parse_events_jsonl(jsonl_content)

        assert len(events) == 2
        assert len(self.analyzer.validation_errors) > 0
