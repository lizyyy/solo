"""Pytest fixtures for metaclass analyzer tests."""

import json
import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import pytest
import yaml

from metaclass_analyzer.models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)


@pytest.fixture
def temp_dir():
    """Create a temporary directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_class_info():
    """Create a sample ClassInfo object."""
    return ClassInfo(
        name="TestClass",
        bases=["BaseClass"],
        metaclass="CustomMeta",
        mro=["TestClass", "BaseClass", "object"],
        fields=[
            FieldInfo(
                name="field1",
                value=1,
                defined_in_class="TestClass",
                order=1,
            ),
            FieldInfo(
                name="field2",
                value="test",
                defined_in_class="TestClass",
                order=2,
                descriptor_type="StringDescriptor",
            ),
        ],
        has_conflict=False,
        defined_at=datetime.now(),
    )


@pytest.fixture
def sample_events():
    """Create sample Event objects."""
    return [
        Event(
            event_type=EventType.PREPARE,
            timestamp=datetime.now(),
            class_name="TestClass",
            metaclass_name="CustomMeta",
            details={"returns": "OrderedDict"},
            order=1,
            success=True,
        ),
        Event(
            event_type=EventType.METACLASS_SELECT,
            timestamp=datetime.now(),
            class_name="TestClass",
            metaclass_name="CustomMeta",
            details={"selected_from": "explicit_metaclass"},
            order=2,
            success=True,
        ),
        Event(
            event_type=EventType.NEW,
            timestamp=datetime.now(),
            class_name="TestClass",
            metaclass_name="CustomMeta",
            details={"bases": ["BaseClass"]},
            order=3,
            success=True,
        ),
        Event(
            event_type=EventType.INIT,
            timestamp=datetime.now(),
            class_name="TestClass",
            metaclass_name="CustomMeta",
            details={"class_obj_created": True},
            order=4,
            success=True,
        ),
        Event(
            event_type=EventType.CLASS_CREATED,
            timestamp=datetime.now(),
            class_name="TestClass",
            metaclass_name="CustomMeta",
            details={"mro": ["TestClass", "BaseClass", "object"]},
            order=5,
            success=True,
        ),
    ]


@pytest.fixture
def sample_conflict():
    """Create a sample ConflictInfo object."""
    return ConflictInfo(
        class_name="MultiInheritClass",
        bases=["MetaClassExample", "SimpleClass"],
        base_metaclasses={
            "MetaClassExample": "CustomMeta",
            "SimpleClass": "type",
        },
        suggested_metaclass="CustomMeta",
        resolution_steps=[
            "Identify the conflicting metaclasses: ['CustomMeta', 'type']",
            "Option 1: Ensure all base classes use 'CustomMeta' metaclass",
            "Option 2: Create a combined metaclass: class CombinedMeta(CustomMeta, type): pass",
            "Apply the combined metaclass explicitly: class MultiInheritClass(..., metaclass=CombinedMeta):",
            "Verify the MRO is correct after resolving the conflict",
        ],
        severity="error",
    )


@pytest.fixture
def sample_yaml_content():
    """Sample YAML content for testing."""
    return {
        "classes": [
            {
                "name": "SimpleClass",
                "bases": [],
                "metaclass": "type",
                "fields": [
                    {"name": "x", "value": 1, "order": 1},
                    {"name": "y", "value": 2, "order": 2},
                ],
                "mro": ["SimpleClass", "object"],
                "source": "snippets/simple_class.py",
            },
            {
                "name": "MetaClassExample",
                "bases": [],
                "metaclass": "CustomMeta",
                "fields": [
                    {"name": "data", "value": None, "order": 1},
                ],
                "mro": ["MetaClassExample", "object"],
                "source": "snippets/custom_metaclass.py",
                "metaclass_details": {
                    "prepare_used": True,
                    "new_implemented": True,
                    "init_implemented": True,
                },
            },
        ]
    }


@pytest.fixture
def sample_jsonl_lines():
    """Sample JSONL lines for testing."""
    return [
        {"event_type": "__prepare__", "timestamp": "2026-05-01T10:00:01.0001", "class_name": "OrderedAttrClass", "metaclass_name": "OrderedMeta", "details": {"returns": "OrderedDict"}, "order": 1, "success": True},
        {"event_type": "metaclass_select", "timestamp": "2026-05-01T10:00:01.0002", "class_name": "OrderedAttrClass", "metaclass_name": "OrderedMeta", "details": {"selected_from": "explicit_metaclass"}, "order": 2, "success": True},
        {"event_type": "__new__", "timestamp": "2026-05-01T10:00:01.0003", "class_name": "OrderedAttrClass", "metaclass_name": "OrderedMeta", "details": {"bases": []}, "order": 3, "success": True},
    ]


@pytest.fixture
def sample_python_code():
    """Sample Python code for testing."""
    return '''
class CustomMeta(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        return {}

    def __new__(mcs, name, bases, namespace, **kwargs):
        return super().__new__(mcs, name, bases, namespace)


class TestClass(metaclass=CustomMeta):
    x = 1
    y = "test"

    def method(self):
        pass
'''


@pytest.fixture
def temp_yaml_file(temp_dir, sample_yaml_content):
    """Create a temporary YAML file."""
    yaml_path = temp_dir / "class-cases.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(sample_yaml_content, f)
    return yaml_path


@pytest.fixture
def temp_jsonl_file(temp_dir, sample_jsonl_lines):
    """Create a temporary JSONL file."""
    jsonl_path = temp_dir / "events.jsonl"
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for line in sample_jsonl_lines:
            f.write(json.dumps(line) + "\n")
    return jsonl_path


@pytest.fixture
def temp_python_file(temp_dir, sample_python_code):
    """Create a temporary Python file."""
    py_path = temp_dir / "test_code.py"
    with open(py_path, "w", encoding="utf-8") as f:
        f.write(sample_python_code)
    return py_path


@pytest.fixture
def temp_snippets_dir(temp_dir, sample_python_code):
    """Create a temporary snippets directory with Python files."""
    snippets_dir = temp_dir / "snippets"
    snippets_dir.mkdir()

    file1 = snippets_dir / "class1.py"
    file1.write_text('''
class Class1:
    x = 1
''')

    file2 = snippets_dir / "class2.py"
    file2.write_text('''
class Class2:
    y = 2
''')

    return snippets_dir


@pytest.fixture
def sample_analysis_result(sample_class_info, sample_events, sample_conflict):
    """Create a sample AnalysisResult object."""
    result = AnalysisResult()
    result.classes[sample_class_info.name] = sample_class_info
    result.timeline = sample_events
    result.conflicts = [sample_conflict]
    result.errors = ["Sample error message"]
    result.warnings = ["Sample warning message"]
    result.suggestions = ["Sample suggestion"]
    return result
