"""
测试工具函数模块
"""

import pytest
import json
from memprofiler.utils import (
    format_size,
    parse_size,
    safe_json_loads,
    validate_json_structure,
    extract_memory_patterns,
    parse_gc_log_line,
    truncate_text,
)


class TestFormatSize:
    """测试 format_size 函数"""
    
    def test_zero_bytes(self):
        assert format_size(0) == "0 B"
    
    def test_bytes(self):
        assert format_size(512) == "512.00 B"
    
    def test_kilobytes(self):
        assert format_size(1024) == "1.00 KB"
        assert format_size(1536) == "1.50 KB"
    
    def test_megabytes(self):
        assert format_size(1024 * 1024) == "1.00 MB"
        assert format_size(1024 * 1024 * 2.5) == "2.50 MB"
    
    def test_gigabytes(self):
        assert format_size(1024**3) == "1.00 GB"


class TestParseSize:
    """测试 parse_size 函数"""
    
    def test_bytes(self):
        assert parse_size("1024") == 1024
        assert parse_size("1024 B") == 1024
    
    def test_kilobytes(self):
        assert parse_size("1 KB") == 1024
        assert parse_size("2 KB") == 2048
    
    def test_megabytes(self):
        assert parse_size("1 MB") == 1024 * 1024
        assert parse_size("0.5 MB") == 524288
    
    def test_case_insensitive(self):
        assert parse_size("1 kb") == 1024
        assert parse_size("1 MB") == 1048576
    
    def test_invalid_format(self):
        with pytest.raises(ValueError):
            parse_size("invalid")


class TestSafeJsonLoads:
    """测试 safe_json_loads 函数"""
    
    def test_valid_json(self):
        data = '{"key": "value", "number": 42}'
        result, errors = safe_json_loads(data)
        assert result == {"key": "value", "number": 42}
        assert errors == []
    
    def test_invalid_json_syntax(self):
        data = '{"key": "value", "number": 42'
        result, errors = safe_json_loads(data)
        assert result is None
        assert len(errors) > 0
        assert any("JSON解析错误" in e for e in errors)
    
    def test_single_quotes(self):
        data = "{'key': 'value'}"
        result, errors = safe_json_loads(data)
        assert result is None
        assert any("单引号" in e or "双引号" in e for e in errors)
    
    def test_with_file_path(self):
        data = '{"key": "value"'
        result, errors = safe_json_loads(data, "/path/to/file.json")
        assert any("file.json" in e for e in errors)


class TestValidateJsonStructure:
    """测试 validate_json_structure 函数"""
    
    def test_valid_structure(self):
        data = {"id": 1, "name": "test", "value": 100}
        required = ["id", "name"]
        errors = validate_json_structure(data, required)
        assert errors == []
    
    def test_missing_fields(self):
        data = {"id": 1}
        required = ["id", "name"]
        errors = validate_json_structure(data, required)
        assert len(errors) == 1
        assert "缺少必需字段" in errors[0]
        assert "name" in errors[0]
    
    def test_non_dict_input(self):
        data = [1, 2, 3]
        required = ["id"]
        errors = validate_json_structure(data, required)
        assert len(errors) == 1
        assert "根节点必须是对象" in errors[0]
    
    def test_with_file_path(self):
        data = {"id": 1}
        required = ["id", "name"]
        errors = validate_json_structure(data, required, "/path/to/file.json")
        assert "file.json" in errors[0]


class TestExtractMemoryPatterns:
    """测试 extract_memory_patterns 函数"""
    
    def test_cycle_reference_keywords(self):
        text = """
        这段代码存在循环引用问题。
        两个对象互相引用对方。
        """
        patterns = extract_memory_patterns(text)
        assert len(patterns["cycle_reference"]) > 0
    
    def test_del_method_detection(self):
        text = """
        class MyClass:
            def __del__(self):
                pass
        """
        patterns = extract_memory_patterns(text)
        assert len(patterns["del_method"]) > 0
    
    def test_weakref_detection(self):
        text = """
        import weakref
        from weakref import WeakKeyDictionary
        """
        patterns = extract_memory_patterns(text)
        assert len(patterns["weakref"]) > 0
    
    def test_gc_related_detection(self):
        text = """
        import gc
        gc.collect()
        gc.set_debug(gc.DEBUG_LEAK)
        """
        patterns = extract_memory_patterns(text)
        assert len(patterns["gc_related"]) > 0
    
    def test_memory_leak_keywords(self):
        text = """
        这里可能存在内存泄漏。
        内存一直在增长。
        """
        patterns = extract_memory_patterns(text)
        assert len(patterns["memory_leak_keywords"]) > 0


class TestParseGcLogLine:
    """测试 parse_gc_log_line 函数"""
    
    def test_uncollectable_object(self):
        line = "gc: uncollectable <Resource at 0x7f8b1c2d3a90>"
        result = parse_gc_log_line(line)
        assert result is not None
        assert result.get("type") == "uncollectable"
        assert result.get("obj_type") == "Resource"
        assert result.get("address") == "0x7f8b1c2d3a90"
    
    def test_cycle_detected(self):
        line = "gc: cycle detected (3 objects):"
        result = parse_gc_log_line(line)
        assert result is not None
        assert result.get("cycle_objects") == 3
    
    def test_has_del_method(self):
        line = "gc: has __del__ <Resource at 0x7f8b1c2d3a90>"
        result = parse_gc_log_line(line)
        assert result is not None
        assert result.get("has_del") is True
    
    def test_normal_gc_line(self):
        line = "gc: collecting generation 2..."
        result = parse_gc_log_line(line)
        assert result is None


class TestTruncateText:
    """测试 truncate_text 函数"""
    
    def test_short_text(self):
        text = "短文本"
        result = truncate_text(text, 100)
        assert result == text
    
    def test_long_text(self):
        text = "这是一段很长的文本，需要被截断"
        result = truncate_text(text, 10)
        assert len(result) == 13  # 10 chars + "..."
        assert result.endswith("...")
    
    def test_exact_length(self):
        text = "1234567890"
        result = truncate_text(text, 10)
        assert result == text
        assert not result.endswith("...")
