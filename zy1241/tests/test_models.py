"""测试数据模型"""

from datetime import datetime

import pytest

from magic_method_analyzer.models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)


class TestMagicMethodType:
    """测试魔术方法类型枚举"""

    def test_enum_values(self):
        assert MagicMethodType.GETATTRIBUTE.value == "__getattribute__"
        assert MagicMethodType.GETATTR.value == "__getattr__"
        assert MagicMethodType.SETATTR.value == "__setattr__"
        assert MagicMethodType.CALL.value == "__call__"
        assert MagicMethodType.LEN.value == "__len__"
        assert MagicMethodType.BOOL.value == "__bool__"
        assert MagicMethodType.EQ.value == "__eq__"
        assert MagicMethodType.HASH.value == "__hash__"
        assert MagicMethodType.ENTER.value == "__enter__"
        assert MagicMethodType.EXIT.value == "__exit__"


class TestIssueType:
    """测试问题类型枚举"""

    def test_enum_values(self):
        assert IssueType.EXCEPTION_OVERRIDE.value == "异常覆盖"
        assert IssueType.HASH_INVALIDATION.value == "哈希失效"
        assert IssueType.TRUTH_VALUE_MISUSE.value == "真值判断误用"
        assert IssueType.CONTEXT_CLEANUP_MISSING.value == "with 清理遗漏"


class TestIssueSeverity:
    """测试严重程度枚举"""

    def test_enum_values(self):
        assert IssueSeverity.CRITICAL.value == "严重"
        assert IssueSeverity.WARNING.value == "警告"
        assert IssueSeverity.INFO.value == "提示"


class TestMagicMethodCall:
    """测试魔术方法调用记录"""

    def test_creation(self):
        call = MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime(2026, 5, 5, 10, 0, 0),
            caller="<module>",
            target="TestObj@0x1",
            args=("name",),
            kwargs={},
            result="value",
            exception=None,
            stack_trace=[],
            metadata={},
        )
        assert call.method_type == MagicMethodType.GETATTRIBUTE
        assert call.target == "TestObj@0x1"
        assert call.args == ("name",)

    def test_to_dict(self):
        call = MagicMethodCall(
            method_type=MagicMethodType.SETATTR,
            timestamp=datetime(2026, 5, 5, 10, 0, 0),
            caller="test",
            target="obj",
            args=("attr", "value"),
            kwargs={},
        )
        data = call.to_dict()
        assert data["method_type"] == "__setattr__"
        assert "timestamp" in data
        assert data["caller"] == "test"


class TestIssue:
    """测试问题记录"""

    def test_creation(self):
        issue = Issue(
            issue_type=IssueType.HASH_INVALIDATION,
            severity=IssueSeverity.CRITICAL,
            title="测试问题",
            description="问题描述",
            location="TestClass",
            suggestion="修复建议",
        )
        assert issue.issue_type == IssueType.HASH_INVALIDATION
        assert issue.severity == IssueSeverity.CRITICAL
        assert issue.title == "测试问题"

    def test_to_dict(self):
        issue = Issue(
            issue_type=IssueType.EXCEPTION_OVERRIDE,
            severity=IssueSeverity.WARNING,
            title="异常覆盖",
            description="描述",
            location="位置",
        )
        data = issue.to_dict()
        assert data["issue_type"] == "异常覆盖"
        assert data["severity"] == "警告"
        assert data["title"] == "异常覆盖"


class TestAnalysisSession:
    """测试分析会话"""

    def test_creation(self):
        session = AnalysisSession(
            session_id="test_123",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            source_files=["test.yaml"],
        )
        assert session.session_id == "test_123"
        assert len(session.method_calls) == 0
        assert len(session.issues) == 0

    def test_to_dict(self):
        session = AnalysisSession(
            session_id="test_123",
            start_time=datetime(2026, 5, 5, 10, 0, 0),
            end_time=datetime(2026, 5, 5, 10, 0, 5),
            source_files=["a.yaml", "b.jsonl"],
        )
        data = session.to_dict()
        assert data["session_id"] == "test_123"
        assert data["method_calls_count"] == 0
        assert data["issues_count"] == 0
