"""Python 魔术方法调用顺序分析工具"""

from .analyzer import MagicMethodAnalyzer
from .exporter import ComparisonExporter, JSONExporter, MarkdownExporter
from .models import (
    AnalysisSession,
    Issue,
    IssueSeverity,
    IssueType,
    MagicCase,
    MagicMethodCall,
    MagicMethodType,
)
from .parsers import JSONLParser, SnippetParser, YAMLParser
from .storage import SQLiteStorage

__version__ = "0.1.0"

__all__ = [
    "MagicMethodAnalyzer",
    "SQLiteStorage",
    "YAMLParser",
    "JSONLParser",
    "SnippetParser",
    "MarkdownExporter",
    "JSONExporter",
    "ComparisonExporter",
    "AnalysisSession",
    "MagicMethodCall",
    "MagicMethodType",
    "Issue",
    "IssueType",
    "IssueSeverity",
    "MagicCase",
    "__version__",
]
