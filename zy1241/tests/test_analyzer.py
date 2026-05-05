"""测试分析引擎"""

from datetime import datetime

import pytest

from magic_method_analyzer.analyzer import MagicMethodAnalyzer
from magic_method_analyzer.models import (
    IssueSeverity,
    IssueType,
    MagicMethodCall,
    MagicMethodType,
)


class TestMagicMethodAnalyzer:
    """测试魔术方法分析器"""

    def test_add_method_call(self):
        analyzer = MagicMethodAnalyzer()
        call = MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=datetime.now(),
            caller="test",
            target="obj1",
            args=("attr",),
            kwargs={},
        )
        analyzer.add_method_call(call)
        
        stats = analyzer.get_method_statistics()
        assert stats["__getattribute__"] == 1

    def test_get_call_sequence(self):
        analyzer = MagicMethodAnalyzer()
        t1 = datetime(2026, 5, 5, 10, 0, 1)
        t2 = datetime(2026, 5, 5, 10, 0, 2)
        t3 = datetime(2026, 5, 5, 10, 0, 3)
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.SETATTR,
            timestamp=t2,
            caller="test",
            target="obj1",
            args=("a", 1),
            kwargs={},
        ))
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=t1,
            caller="test",
            target="obj1",
            args=("a",),
            kwargs={},
        ))
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.GETATTR,
            timestamp=t3,
            caller="test",
            target="obj1",
            args=("missing",),
            kwargs={},
        ))
        
        sequence = analyzer.get_call_sequence("obj1")
        assert len(sequence) == 3
        assert sequence[0].method_type == MagicMethodType.GETATTRIBUTE
        assert sequence[1].method_type == MagicMethodType.SETATTR
        assert sequence[2].method_type == MagicMethodType.GETATTR

    def test_analyze_exception_override_getattribute(self):
        analyzer = MagicMethodAnalyzer()
        t1 = datetime.now()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.GETATTRIBUTE,
            timestamp=t1,
            caller="test",
            target="obj1",
            args=("missing_attr",),
            kwargs={},
            exception=Exception("AttributeError: missing_attr"),
        ))
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.GETATTR,
            timestamp=datetime.now(),
            caller="test",
            target="obj1",
            args=("missing_attr",),
            kwargs={},
            result="default",
        ))
        
        issues = analyzer.analyze()
        
        exception_issues = [i for i in issues if i.issue_type == IssueType.EXCEPTION_OVERRIDE]
        assert len(exception_issues) >= 1

    def test_analyze_context_manager_missing_exit(self):
        analyzer = MagicMethodAnalyzer()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.ENTER,
            timestamp=datetime.now(),
            caller="test",
            target="resource1",
            args=[],
            kwargs={},
            result="resource1",
        ))
        
        issues = analyzer.analyze()
        
        cleanup_issues = [i for i in issues if i.issue_type == IssueType.CONTEXT_CLEANUP_MISSING]
        assert len(cleanup_issues) == 1
        assert cleanup_issues[0].severity == IssueSeverity.CRITICAL

    def test_analyze_context_manager_with_exit(self):
        analyzer = MagicMethodAnalyzer()
        t1 = datetime.now()
        t2 = datetime.now()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.ENTER,
            timestamp=t1,
            caller="test",
            target="resource1",
            args=[],
            kwargs={},
            result="resource1",
        ))
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.EXIT,
            timestamp=t2,
            caller="test",
            target="resource1",
            args=[None, None, None],
            kwargs={},
            result=False,
        ))
        
        issues = analyzer.analyze()
        
        cleanup_issues = [i for i in issues if i.issue_type == IssueType.CONTEXT_CLEANUP_MISSING]
        assert len(cleanup_issues) == 0

    def test_analyze_exit_returns_true(self):
        analyzer = MagicMethodAnalyzer()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.ENTER,
            timestamp=datetime.now(),
            caller="test",
            target="resource1",
            args=[],
            kwargs={},
            result="resource1",
        ))
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.EXIT,
            timestamp=datetime.now(),
            caller="test",
            target="resource1",
            args=["ValueError", "test error", "<traceback>"],
            kwargs={},
            result=True,
        ))
        
        issues = analyzer.analyze()
        
        exception_issues = [
            i for i in issues 
            if i.issue_type == IssueType.EXCEPTION_OVERRIDE
            and "抑制" in i.title
        ]
        assert len(exception_issues) >= 1
        assert exception_issues[0].severity == IssueSeverity.CRITICAL

    def test_analyze_len_returns_negative(self):
        analyzer = MagicMethodAnalyzer()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.LEN,
            timestamp=datetime.now(),
            caller="test",
            target="obj1",
            args=[],
            kwargs={},
            result=-1,
            exception=Exception("ValueError: __len__() should return >= 0"),
        ))
        
        issues = analyzer.analyze()
        
        truth_issues = [i for i in issues if i.issue_type == IssueType.TRUTH_VALUE_MISUSE]
        assert len(truth_issues) >= 1
        assert "负值" in truth_issues[0].title

    def test_analyze_hash_returns_none(self):
        analyzer = MagicMethodAnalyzer()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.HASH,
            timestamp=datetime.now(),
            caller="test",
            target="obj1",
            args=[],
            kwargs={},
            result=None,
            exception=Exception("TypeError: unhashable type"),
        ))
        
        issues = analyzer.analyze()
        
        hash_issues = [i for i in issues if i.issue_type == IssueType.HASH_INVALIDATION]
        assert len(hash_issues) >= 1

    def test_analyze_eq_without_hash(self):
        analyzer = MagicMethodAnalyzer()
        
        analyzer.add_method_call(MagicMethodCall(
            method_type=MagicMethodType.EQ,
            timestamp=datetime.now(),
            caller="test",
            target="obj1",
            args=["obj2"],
            kwargs={},
            result=True,
        ))
        
        issues = analyzer.analyze()
        
        hash_issues = [
            i for i in issues 
            if i.issue_type == IssueType.HASH_INVALIDATION
            and "缺少 __hash__" in i.title
        ]
        assert len(hash_issues) >= 1

    def test_get_method_statistics(self):
        analyzer = MagicMethodAnalyzer()
        
        for _ in range(3):
            analyzer.add_method_call(MagicMethodCall(
                method_type=MagicMethodType.GETATTRIBUTE,
                timestamp=datetime.now(),
                caller="test",
                target="obj1",
                args=("a",),
                kwargs={},
            ))
        
        for _ in range(2):
            analyzer.add_method_call(MagicMethodCall(
                method_type=MagicMethodType.SETATTR,
                timestamp=datetime.now(),
                caller="test",
                target="obj1",
                args=("a", 1),
                kwargs={},
            ))
        
        stats = analyzer.get_method_statistics()
        assert stats["__getattribute__"] == 3
        assert stats["__setattr__"] == 2
