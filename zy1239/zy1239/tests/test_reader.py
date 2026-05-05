"""Tests for the reader module."""

import json
from pathlib import Path

import pytest
import yaml

from metaclass_analyzer.errors import (
    JsonlFormatError,
    MissingFieldError,
    PythonSyntaxError,
    YamlFormatError,
)
from metaclass_analyzer.reader import (
    JsonlReader,
    PythonReader,
    SnippetsReader,
    YamlReader,
)


class TestYamlReader:
    """Tests for YamlReader."""

    def test_read_valid_yaml(self, temp_yaml_file):
        """Test reading a valid YAML file."""
        reader = YamlReader(str(temp_yaml_file))
        data = reader.read()

        assert "classes" in data
        assert len(data["classes"]) == 2

    def test_read_nonexistent_file(self):
        """Test reading a nonexistent file."""
        with pytest.raises(FileNotFoundError):
            YamlReader("/nonexistent/path/to/file.yaml")

    def test_parse_classes(self, temp_yaml_file):
        """Test parsing classes from YAML."""
        reader = YamlReader(str(temp_yaml_file))
        data = reader.read()
        classes = reader.parse_classes(data)

        assert len(classes) == 2
        assert classes[0].name == "SimpleClass"
        assert classes[0].metaclass == "type"
        assert len(classes[0].fields) == 2
        assert classes[0].fields[0].name == "x"

    def test_missing_class_name(self, temp_dir):
        """Test YAML with missing class name."""
        bad_yaml = {
            "classes": [
                {"bases": [], "metaclass": "type"}
            ]
        }
        yaml_path = temp_dir / "bad.yaml"
        with open(yaml_path, "w") as f:
            yaml.dump(bad_yaml, f)

        reader = YamlReader(str(yaml_path))
        data = reader.read()

        with pytest.raises(YamlFormatError):
            reader.parse_classes(data)

    def test_empty_yaml(self, temp_dir):
        """Test empty YAML file."""
        yaml_path = temp_dir / "empty.yaml"
        yaml_path.write_text("")

        with pytest.raises(YamlFormatError):
            reader = YamlReader(str(yaml_path))
            reader.read()

    def test_invalid_yaml_syntax(self, temp_dir):
        """Test YAML with invalid syntax."""
        yaml_path = temp_dir / "invalid.yaml"
        yaml_path.write_text("invalid: yaml: syntax: [broken")

        with pytest.raises(YamlFormatError):
            reader = YamlReader(str(yaml_path))
            reader.read()


class TestJsonlReader:
    """Tests for JsonlReader."""

    def test_read_valid_jsonl(self, temp_jsonl_file):
        """Test reading a valid JSONL file."""
        reader = JsonlReader(str(temp_jsonl_file))
        events = reader.parse_events()

        assert len(events) == 3
        assert events[0].event_type.value == "__prepare__"
        assert events[0].class_name == "OrderedAttrClass"

    def test_read_nonexistent_file(self):
        """Test reading a nonexistent JSONL file."""
        with pytest.raises(FileNotFoundError):
            JsonlReader("/nonexistent/path/to/file.jsonl")

    def test_invalid_json_line(self, temp_dir):
        """Test JSONL with invalid JSON on a line."""
        jsonl_path = temp_dir / "bad.jsonl"
        jsonl_path.write_text('{"valid": true}\ninvalid json\n{"also_valid": true}')

        reader = JsonlReader(str(jsonl_path))

        with pytest.raises(JsonlFormatError):
            list(reader.read_lines())

    def test_missing_event_type(self, temp_dir):
        """Test JSONL with missing event_type."""
        jsonl_path = temp_dir / "missing_type.jsonl"
        jsonl_path.write_text('{"timestamp": "2026-05-01T10:00:00", "class_name": "Test"}')

        reader = JsonlReader(str(jsonl_path))

        with pytest.raises(MissingFieldError):
            reader.parse_events()

    def test_unknown_event_type(self, temp_dir):
        """Test JSONL with unknown event type."""
        jsonl_path = temp_dir / "unknown_type.jsonl"
        jsonl_path.write_text('{"event_type": "unknown_type", "timestamp": "2026-05-01T10:00:00", "class_name": "Test"}')

        reader = JsonlReader(str(jsonl_path))

        with pytest.raises(JsonlFormatError):
            reader.parse_events()


class TestPythonReader:
    """Tests for PythonReader."""

    def test_read_source(self, temp_python_file):
        """Test reading Python source code."""
        reader = PythonReader(str(temp_python_file))
        source = reader.read_source()

        assert "class CustomMeta" in source
        assert "class TestClass" in source

    def test_parse_ast(self, temp_python_file):
        """Test parsing Python AST."""
        reader = PythonReader(str(temp_python_file))
        tree = reader.parse_ast()

        assert tree is not None

    def test_extract_classes(self, temp_python_file):
        """Test extracting class definitions from Python."""
        reader = PythonReader(str(temp_python_file))
        classes = reader.extract_classes()

        assert len(classes) == 2

        custom_meta = [c for c in classes if c["name"] == "CustomMeta"][0]
        assert custom_meta["metaclass"] == "type"
        assert custom_meta["uses_metaclass"] == False

        test_class = [c for c in classes if c["name"] == "TestClass"][0]
        assert test_class["metaclass"] == "CustomMeta"
        assert test_class["uses_metaclass"] == True

    def test_syntax_error(self, temp_dir):
        """Test Python file with syntax error."""
        py_path = temp_dir / "bad.py"
        py_path.write_text("class BadSyntax(")

        reader = PythonReader(str(py_path))

        with pytest.raises(PythonSyntaxError):
            reader.parse_ast()

    def test_nonexistent_file(self):
        """Test reading a nonexistent Python file."""
        with pytest.raises(FileNotFoundError):
            PythonReader("/nonexistent/path/to/file.py")


class TestSnippetsReader:
    """Tests for SnippetsReader."""

    def test_get_python_files(self, temp_snippets_dir):
        """Test getting Python files from snippets directory."""
        reader = SnippetsReader(str(temp_snippets_dir))
        files = reader.get_python_files()

        assert len(files) == 2
        assert files[0].name in ["class1.py", "class2.py"]
        assert files[1].name in ["class1.py", "class2.py"]

    def test_read_all_snippets(self, temp_snippets_dir):
        """Test reading all snippets."""
        reader = SnippetsReader(str(temp_snippets_dir))
        classes = reader.read_all_snippets()

        assert len(classes) == 2
        class_names = [c["name"] for c in classes]
        assert "Class1" in class_names
        assert "Class2" in class_names

    def test_nonexistent_directory(self):
        """Test reading a nonexistent snippets directory."""
        with pytest.raises(FileNotFoundError):
            SnippetsReader("/nonexistent/path/to/snippets")

    def test_not_a_directory(self, temp_dir):
        """Test passing a file instead of directory."""
        file_path = temp_dir / "file.py"
        file_path.write_text("class Test: pass")

        with pytest.raises(NotADirectoryError):
            SnippetsReader(str(file_path))
