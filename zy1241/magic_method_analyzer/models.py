"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class MagicMethodType(Enum):
    """魔术方法类型枚举"""
    GETATTRIBUTE = "__getattribute__"
    GETATTR = "__getattr__"
    SETATTR = "__setattr__"
    DELATTR = "__delattr__"
    CALL = "__call__"
    LEN = "__len__"
    BOOL = "__bool__"
    EQ = "__eq__"
    HASH = "__hash__"
    ENTER = "__enter__"
    EXIT = "__exit__"
    STR = "__str__"
    REPR = "__repr__"
    INIT = "__init__"
    NEW = "__new__"


class IssueType(Enum):
    """问题类型枚举"""
    EXCEPTION_OVERRIDE = "异常覆盖"
    HASH_INVALIDATION = "哈希失效"
    TRUTH_VALUE_MISUSE = "真值判断误用"
    CONTEXT_CLEANUP_MISSING = "with 清理遗漏"
    ATTRIBUTE_ACCESS_ISSUE = "属性访问问题"
    CALL_ISSUE = "调用问题"


class IssueSeverity(Enum):
    """问题严重程度"""
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "提示"


@dataclass
class MagicMethodCall:
    """魔术方法调用记录"""
    method_type: MagicMethodType
    timestamp: datetime
    caller: str
    target: str
    args: tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    result: Any = None
    exception: Optional[Exception] = None
    stack_trace: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "method_type": self.method_type.value,
            "timestamp": self.timestamp.isoformat(),
            "caller": self.caller,
            "target": self.target,
            "args": str(self.args),
            "kwargs": str(self.kwargs),
            "result": str(self.result) if self.result is not None else None,
            "exception": str(self.exception) if self.exception else None,
            "stack_trace": self.stack_trace,
            "metadata": self.metadata,
        }


@dataclass
class Issue:
    """分析发现的问题"""
    issue_type: IssueType
    severity: IssueSeverity
    title: str
    description: str
    location: str
    related_calls: List[MagicMethodCall] = field(default_factory=list)
    suggestion: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "location": self.location,
            "related_calls": [c.to_dict() for c in self.related_calls],
            "suggestion": self.suggestion,
            "metadata": self.metadata,
        }


@dataclass
class AnalysisSession:
    """分析会话"""
    session_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    source_files: List[str] = field(default_factory=list)
    method_calls: List[MagicMethodCall] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "source_files": self.source_files,
            "method_calls_count": len(self.method_calls),
            "issues_count": len(self.issues),
            "metadata": self.metadata,
        }


@dataclass
class MagicCase:
    """魔术方法测试用例（来自 YAML）"""
    case_id: str
    name: str
    description: str
    category: str
    expected_behavior: List[str]
    code_snippet: str
    metadata: Dict[str, Any] = field(default_factory=dict)
