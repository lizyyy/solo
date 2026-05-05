"""测试文件解析器"""

import json
import tempfile
from pathlib import Path

import pytest
import yaml

from magic_method_analyzer.parsers import JSONLParser, SnippetParser, YAMLParser


class TestYAMLParser:
    """测试 YAML 解析器"""

    def test_parse_valid_file(self, tmp_path: Path):
        yaml_content = """
cases:
  - id: case_001
    name: 测试用例
    category: test
    description: 测试描述
    expected_behavior:
      - 行为1
    code_snippet: |
      class Test:
          pass
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        cases = YAMLParser.parse_file(yaml_file)
        assert len(cases) == 1
        assert cases[0].case_id == "case_001"
        assert cases[0].name == "测试用例"

    def test_parse_missing_cases_field(self, tmp_path: Path):
        yaml_content = """
other: data
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        with pytest.raises(ValueError, match="缺少 'cases' 字段"):
            YAMLParser.parse_file(yaml_file)

    def test_validate_format_valid(self, tmp_path: Path):
        yaml_content = """
cases:
  - id: case_001
    name: 测试用例
    category: test
    description: 测试描述
    expected_behavior: []
    code_snippet: "pass"
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        valid, errors, warnings = YAMLParser.validate_format(yaml_file)
        assert valid is True
        assert len(errors) == 0

    def test_validate_format_invalid(self, tmp_path: Path):
        yaml_content = """
invalid_yaml: [
"""
        yaml_file = tmp_path / "test.yaml"
        yaml_file.write_text(yaml_content)

        valid, errors, warnings = YAMLParser.validate_format(yaml_file)
        assert valid is False
        assert len(errors) > 0


class TestJSONLParser:
    """测试 JSONL 解析器"""

    def test_parse_valid_file(self, tmp_path: Path):
        jsonl_content = '\n'.join([
            json.dumps({
                "method": "__getattribute__",
                "timestamp": "2026-05-05T10:00:00.000",
                "caller": "<module>",
                "target": "TestObj@0x1",
                "args": ["name"],
                "kwargs": {},
                "result": "value"
            }),
            json.dumps({
                "method": "__setattr__",
                "timestamp": "2026-05-05T10:00:00.001",
                "caller": "<module>",
                "target": "TestObj@0x1",
                "args": ["age", 30],
                "kwargs": {}
            })
        ])
        jsonl_file = tmp_path / "test.jsonl"
        jsonl_file.write_text(jsonl_content)

        calls = JSONLParser.parse_file(jsonl_file)
        assert len(calls) == 2
        assert calls[0].method_type.value == "__getattribute__"
        assert calls[1].method_type.value == "__setattr__"

    def test_parse_invalid_json(self, tmp_path: Path):
        jsonl_content = """
{"method": "__getattribute__", invalid}
"""
        jsonl_file = tmp_path / "test.jsonl"
        jsonl_file.write_text(jsonl_content)

        with pytest.raises(ValueError):
            JSONLParser.parse_file(jsonl_file)

    def test_validate_format_valid(self, tmp_path: Path):
        jsonl_content = json.dumps({
            "method": "__getattribute__",
            "timestamp": "2026-05-05T10:00:00.000",
            "caller": "test",
            "target": "obj",
            "args": [],
            "kwargs": {}
        })
        jsonl_file = tmp_path / "test.jsonl"
        jsonl_file.write_text(jsonl_content)

        valid, errors, warnings = JSONLParser.validate_format(jsonl_file)
        assert valid is True

    def test_validate_format_missing_method(self, tmp_path: Path):
        jsonl_content = json.dumps({
            "timestamp": "2026-05-05T10:00:00.000",
            "caller": "test"
        })
        jsonl_file = tmp_path / "test.jsonl"
        jsonl_file.write_text(jsonl_content)

        valid, errors, warnings = JSONLParser.validate_format(jsonl_file)
        assert valid is False
        assert any("缺少 'method'" in e for e in errors)


class TestSnippetParser:
    """测试代码片段解析器"""

    def test_extract_magic_methods(self):
        code = """
class TestClass:
    def __init__(self):
        pass
    
    def __getattr__(self, name):
        return name
    
    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)
    
    def normal_method(self):
        pass

class AnotherClass:
    def __len__(self):
        return 0
    
    def __bool__(self):
        return True
"""
        methods = SnippetParser.extract_magic_methods(code)
        
        assert "TestClass" in methods
        assert "AnotherClass" in methods
        
        test_methods = [m["name"] for m in methods["TestClass"]]
        assert "__init__" in test_methods
        assert "__getattr__" in test_methods
        assert "__setattr__" in test_methods
        assert "normal_method" not in test_methods
        
        another_methods = [m["name"] for m in methods["AnotherClass"]]
        assert "__len__" in another_methods
        assert "__bool__" in another_methods

    def test_extract_magic_methods_invalid_syntax(self):
        code = """
class Test:
    def __init__(self
        pass
"""
        with pytest.raises(ValueError):
            SnippetParser.extract_magic_methods(code)

    def test_validate_syntax_valid(self, tmp_path: Path):
        code = """
class Test:
    def __init__(self):
        pass
"""
        py_file = tmp_path / "test.py"
        py_file.write_text(code)

        valid, errors, warnings = SnippetParser.validate_syntax(py_file)
        assert valid is True
        assert len(errors) == 0

    def test_validate_syntax_invalid(self, tmp_path: Path):
        code = """
class Test:
    def __init__(self
        pass
"""
        py_file = tmp_path / "test.py"
        py_file.write_text(code)

        valid, errors, warnings = SnippetParser.validate_syntax(py_file)
        assert valid is False
        assert len(errors) > 0

    def test_parse_directory(self, tmp_path: Path):
        (tmp_path / "a.py").write_text("class A:\n    pass\n")
        (tmp_path / "b.py").write_text("class B:\n    pass\n")
        (tmp_path / "not_py.txt").write_text("not python\n")

        snippets = SnippetParser.parse_directory(tmp_path)
        
        assert "a.py" in snippets
        assert "b.py" in snippets
        assert "not_py.txt" not in snippets
