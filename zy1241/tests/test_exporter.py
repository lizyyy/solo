"""测试报告导出器"""

from datetime import datetime
from pathlib import Path

import pytest

from magic_method_analyzer.exporter import (
    ComparisonExporter,
    JSONExporter,
    MarkdownExporter,
)
from magic_method_analyzer.models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)


class TestMarkdownExporter:
    """测试 Markdown 导出器"""

    def test_export_basic(self):
        session = AnalysisSession(
            session_id="test_md_001",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            end_time=datetime(2026, 5, 5, 10, 0, 5),
            source_files=["test.yaml", "test.jsonl"],
        )
        
        content = MarkdownExporter.export(session)
        
        assert "# 魔术方法分析报告" in content
        assert "test_md_001" in content
        assert "test.yaml" in content
        assert "方法调用次数" in content

    def test_export_with_issues(self):
        session = AnalysisSession(
            session_id="test_issues",
            start_time=datetime.now(),
        )
        
        session.issues.append(Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.CRITICAL,
            title="严重问题",
            description="严重问题描述",
            location="TestClass",
            suggestion="修复建议",
        ))
        
        session.issues.append(Issue(
            issue_type=IssueType.EXCEPTION_OVERRIDE,
            severity=IssueSeverity.WARNING,
            title="警告问题",
            description="警告描述",
            location="AnotherClass",
            suggestion="",
        ))
        
        session.issues.append(Issue(
            issue_type=IssueType.TRUTH_VALUE_MISUSE,
            severity=IssueSeverity.INFO,
            title="提示问题",
            description="提示描述",
            location="ThirdClass",
            suggestion="",
        ))
        
        content = MarkdownExporter.export(session)
        
        assert "严重问题" in content
        assert "警告问题" in content
        assert "提示问题" in content
        assert "问题汇总" in content
        assert "严重问题: 1 个" in content
        assert "警告: 1 个" in content
        assert "提示: 1 个" in content

    def test_export_with_method_calls(self):
        session = AnalysisSession(
            session_id="test_calls",
            start_time=datetime.now(),
        )
        
        session.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime(2026, 5, 5, 10, 0, 1),
            caller="test",
            target="obj1",
            args=("attr",),
            kwargs={},
            result="value",
        ))
        
        session.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.SETATTR,
            timestamp=datetime(2026, 5, 5, 10, 0, 2),
            caller="test",
            target="obj1",
            args=("attr", "new_value"),
            kwargs={},
            result=None,
        ))
        
        content = MarkdownExporter.export(session)
        
        assert "方法调用序列" in content
        assert "方法调用统计" in content
        assert "__getattribute__" in content
        assert "__setattr__" in content

    def test_export_to_file(self, tmp_path: Path):
        output_file = tmp_path / "report.md"
        
        session = AnalysisSession(
            session_id="file_test",
            start_time=datetime.now(),
        )
        
        MarkdownExporter.export(session, output_file)
        
        assert output_file.exists()
        content = output_file.read_text(encoding="utf-8")
        assert "file_test" in content


class TestJSONExporter:
    """测试 JSON 导出器"""

    def test_export_basic(self):
        session = AnalysisSession(
            session_id="test_json_001",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            end_time=datetime(2026, 5, 5, 10, 0, 5),
            source_files=["a.yaml", "b.jsonl"],
            metadata={"test": "value"},
        )
        
        import json
        content = JSONExporter.export(session)
        data = json.loads(content)
        
        assert data["session_id"] == "test_json_001"
        assert data["source_files"] == ["a.yaml", "b.jsonl"]
        assert data["metadata"]["test"] == "value"
        assert "generated_at" in data

    def test_export_with_issues(self):
        session = AnalysisSession(
            session_id="json_issues",
            start_time=datetime.now(),
        )
        
        session.issues.append(Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.CRITICAL,
            title="哈希问题",
            description="描述",
            location="位置",
            suggestion="建议",
        ))
        
        import json
        content = JSONExporter.export(session)
        data = json.loads(content)
        
        assert data["summary"]["issues_count"] == 1
        assert len(data["issues"]) == 1
        assert data["issues"][0]["type"] == "哈希失效"
        assert data["issues"][0]["severity"] == "严重"
        assert data["issues"][0]["title"] == "哈希问题"

    def test_export_with_method_calls(self):
        session = AnalysisSession(
            session_id="json_calls",
            start_time=datetime.now(),
        )
        
        session.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.CALL,
            timestamp=datetime(2026, 5, 5, 10, 0, 0),
            caller="test",
            target="obj",
            args=(1, 2),
            kwargs={"key": "val"},
            result="done",
        ))
        
        import json
        content = JSONExporter.export(session)
        data = json.loads(content)
        
        assert data["summary"]["method_calls_count"] == 1
        assert len(data["method_calls"]) == 1
        assert data["method_calls"][0]["method_type"] == "__call__"

    def test_export_to_file(self, tmp_path: Path):
        output_file = tmp_path / "report.json"
        
        session = AnalysisSession(
            session_id="json_file",
            start_time=datetime.now(),
        )
        
        JSONExporter.export(session, output_file)
        
        assert output_file.exists()
        import json
        data = json.loads(output_file.read_text(encoding="utf-8"))
        assert data["session_id"] == "json_file"


class TestComparisonExporter:
    """测试比较导出器"""

    def test_compare_basic(self):
        session1 = AnalysisSession(
            session_id="session_a",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            source_files=["a.yaml"],
        )
        session1.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime.now(),
            caller="test",
            target="obj",
            args=("a",),
            kwargs={},
        ))
        session1.issues.append(Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.CRITICAL,
            title="问题1",
            description="",
            location="",
        ))
        
        session2 = AnalysisSession(
            session_id="session_b",
            start_time=datetime(2026, 5, 5, 11, 0, 0),
            source_files=["b.yaml"],
        )
        session2.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime.now(),
            caller="test",
            target="obj",
            args=("a",),
            kwargs={},
        ))
        session2.method_calls.append(MagicMethodCall(
            method_type=MagicMethodType.SETATTR,
            timestamp=datetime.now(),
            caller="test",
            target="obj",
            args=("b", 2),
            kwargs={},
        ))
        
        content = ComparisonExporter.compare(session1, session2)
        
        assert "# 会话比较报告" in content
        assert "session_a" in content
        assert "session_b" in content
        assert "方法调用差异" in content
        assert "问题差异" in content

    def test_compare_to_file(self, tmp_path: Path):
        output_file = tmp_path / "comparison.md"
        
        session1 = AnalysisSession(
            session_id="cmp_a",
            start_time=datetime.now(),
        )
        session2 = AnalysisSession(
            session_id="cmp_b",
            start_time=datetime.now(),
        )
        
        ComparisonExporter.compare(session1, session2, output_file)
        
        assert output_file.exists()
        content = output_file.read_text(encoding="utf-8")
        assert "cmp_a" in content
        assert "cmp_b" in content
