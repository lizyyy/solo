"""Tests for parser modules."""

import json
import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from decorator_analyzer.parser.jsonl_parser import JsonlParser, JsonlParseError
from decorator_analyzer.parser.yaml_parser import YamlParser, YamlParseError
from decorator_analyzer.parser.py_parser import PyParser, PyParseError


class TestYamlParser:
    """Tests for YamlParser."""

    def test_parse_valid_yaml(self, tmp_path: Path) -> None:
        """Test parsing valid YAML."""
        yaml_content = """
functions:
  - name: test_func
    module: test_module
    signature: "(a: int, b: str) -> bool"
    decorators:
      - name: timer
        type: simple
        line_number: 10
        has_wraps: false
"""
        yaml_file = tmp_path / "decorators.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        
        parser = YamlParser(yaml_file)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].function.name == "test_func"
        assert results[0].function.module == "test_module"
        assert len(results[0].decorators) == 1
        assert results[0].decorators[0].name == "timer"

    def test_parse_missing_functions(self, tmp_path: Path) -> None:
        """Test parsing YAML without 'functions' section."""
        yaml_content = """
other_section:
  - item1
"""
        yaml_file = tmp_path / "decorators.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        
        parser = YamlParser(yaml_file)
        with pytest.raises(YamlParseError, match="Missing required 'functions' section"):
            parser.parse()

    def test_parse_missing_function_name(self, tmp_path: Path) -> None:
        """Test parsing YAML with function missing 'name'."""
        yaml_content = """
functions:
  - module: test_module
    signature: () -> None
"""
        yaml_file = tmp_path / "decorators.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        
        parser = YamlParser(yaml_file)
        with pytest.raises(YamlParseError, match="missing required field"):
            parser.parse()

    def test_parse_invalid_yaml_syntax(self, tmp_path: Path) -> None:
        """Test parsing invalid YAML syntax."""
        yaml_content = """
functions:
  - name: test
    signature: invalid: yaml: syntax
"""
        yaml_file = tmp_path / "decorators.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        
        parser = YamlParser(yaml_file)
        with pytest.raises(YamlParseError):
            parser.parse()

    def test_parse_file_not_found(self, tmp_path: Path) -> None:
        """Test parsing non-existent file."""
        yaml_file = tmp_path / "nonexistent.yaml"
        parser = YamlParser(yaml_file)
        
        with pytest.raises(YamlParseError, match="not found"):
            parser.parse()

    def test_parse_decorator_with_args(self, tmp_path: Path) -> None:
        """Test parsing decorator with arguments."""
        yaml_content = """
functions:
  - name: retry_func
    module: test_module
    signature: () -> None
    decorators:
      - name: retry
        type: with_args
        line_number: 5
        has_wraps: true
        parameters:
          max_attempts: "3"
          delay: "1.0"
"""
        yaml_file = tmp_path / "decorators.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        
        parser = YamlParser(yaml_file)
        results = parser.parse()
        
        assert len(results) == 1
        assert len(results[0].decorators) == 1
        assert results[0].decorators[0].parameters["max_attempts"] == "3"
        assert results[0].decorators[0].has_wraps is True


class TestJsonlParser:
    """Tests for JsonlParser."""

    def test_parse_valid_jsonl(self, tmp_path: Path) -> None:
        """Test parsing valid JSONL file."""
        events = [
            {
                "function_id": "test_func",
                "timestamp": "2024-01-15T10:30:00",
                "caller": "main",
                "args": [1, 2],
                "kwargs": {"key": "value"},
                "return_value": "success",
                "exception": None,
                "decorator_stack": ["timer"],
                "duration_ms": 123.45,
            }
        ]
        
        jsonl_file = tmp_path / "events.jsonl"
        jsonl_file.write_text(
            "\n".join(json.dumps(e) for e in events),
            encoding="utf-8"
        )
        
        parser = JsonlParser(jsonl_file)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].function_id == "test_func"
        assert results[0].caller == "main"
        assert results[0].duration_ms == 123.45

    def test_parse_multiple_events(self, tmp_path: Path) -> None:
        """Test parsing multiple events."""
        events = [
            {"function_id": "func1", "timestamp": "2024-01-15T10:30:00"},
            {"function_id": "func2", "timestamp": "2024-01-15T10:31:00"},
            {"function_id": "func3", "timestamp": "2024-01-15T10:32:00"},
        ]
        
        jsonl_file = tmp_path / "events.jsonl"
        jsonl_file.write_text(
            "\n".join(json.dumps(e) for e in events),
            encoding="utf-8"
        )
        
        parser = JsonlParser(jsonl_file)
        results = parser.parse()
        
        assert len(results) == 3
        assert results[0].function_id == "func1"
        assert results[1].function_id == "func2"
        assert results[2].function_id == "func3"

    def test_parse_invalid_json(self, tmp_path: Path) -> None:
        """Test parsing invalid JSON."""
        jsonl_content = """
{"function_id": "test", "timestamp": "2024-01-15T10:30:00"}
invalid json here
{"function_id": "test2", "timestamp": "2024-01-15T10:31:00"}
"""
        jsonl_file = tmp_path / "events.jsonl"
        jsonl_file.write_text(jsonl_content.strip(), encoding="utf-8")
        
        parser = JsonlParser(jsonl_file)
        with pytest.raises(JsonlParseError, match="Invalid JSON"):
            parser.parse()

    def test_parse_file_not_found(self, tmp_path: Path) -> None:
        """Test parsing non-existent file."""
        jsonl_file = tmp_path / "nonexistent.jsonl"
        parser = JsonlParser(jsonl_file)
        
        with pytest.raises(JsonlParseError, match="not found"):
            parser.parse()

    def test_parse_with_exception(self, tmp_path: Path) -> None:
        """Test parsing event with exception."""
        event = {
            "function_id": "failing_func",
            "timestamp": "2024-01-15T10:30:00",
            "exception": "ValueError: Something went wrong",
            "decorator_stack": ["catch_all"],
        }
        
        jsonl_file = tmp_path / "events.jsonl"
        jsonl_file.write_text(json.dumps(event), encoding="utf-8")
        
        parser = JsonlParser(jsonl_file)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].exception == "ValueError: Something went wrong"


class TestPyParser:
    """Tests for PyParser."""

    def test_parse_simple_decorator(self, tmp_path: Path) -> None:
        """Test parsing simple decorator."""
        code = '''
def timer(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@timer
def my_function():
    """Test function."""
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].function.name == "my_function"
        assert len(results[0].decorators) == 1
        assert results[0].decorators[0].name == "timer"

    def test_parse_decorator_with_wraps(self, tmp_path: Path) -> None:
        """Test parsing decorator using functools.wraps."""
        code = '''
import functools

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@timer
def my_function():
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].function.name == "my_function"

    def test_parse_stacked_decorators(self, tmp_path: Path) -> None:
        """Test parsing multiple decorators on same function."""
        code = '''
def decorator_a(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

def decorator_b(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

@decorator_a
@decorator_b
def my_function():
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 1
        assert len(results[0].decorators) == 2

    def test_parse_decorator_with_args(self, tmp_path: Path) -> None:
        """Test parsing decorator with arguments."""
        code = '''
def retry(max_attempts=3):
    def decorator(func):
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator

@retry(max_attempts=5)
def my_function():
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 1
        assert len(results[0].decorators) == 1

    def test_parse_async_decorator(self, tmp_path: Path) -> None:
        """Test parsing async function with decorator."""
        code = '''
import functools

def async_timer(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    return wrapper

@async_timer
async def my_async_function():
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 1
        assert results[0].function.is_async is True

    def test_parse_method_decorator(self, tmp_path: Path) -> None:
        """Test parsing method with decorator."""
        code = '''
def log_call(func):
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

class MyClass:
    @log_call
    def my_method(self):
        pass
    
    @staticmethod
    def static_method():
        pass
    
    @classmethod
    def class_method(cls):
        pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) >= 3

    def test_parse_invalid_syntax(self, tmp_path: Path) -> None:
        """Test parsing Python file with invalid syntax."""
        code = '''
def invalid syntax here:
    pass
'''
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        (snippets_dir / "test.py").write_text(code, encoding="utf-8")
        
        parser = PyParser(snippets_dir)
        with pytest.raises(PyParseError, match="Syntax error"):
            parser.parse()

    def test_parse_directory_not_found(self, tmp_path: Path) -> None:
        """Test parsing non-existent directory."""
        snippets_dir = tmp_path / "nonexistent"
        parser = PyParser(snippets_dir)
        
        with pytest.raises(PyParseError, match="not found"):
            parser.parse()

    def test_parse_empty_directory(self, tmp_path: Path) -> None:
        """Test parsing empty directory."""
        snippets_dir = tmp_path / "snippets"
        snippets_dir.mkdir()
        
        parser = PyParser(snippets_dir)
        results = parser.parse()
        
        assert len(results) == 0
