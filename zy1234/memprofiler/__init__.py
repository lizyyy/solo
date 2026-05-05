"""
MemProfiler - Python内存问题排查小工具

一个用于Python内存问题排查的教学工具，支持分析tracemalloc快照、
GC日志、对象引用关系等数据，帮助开发者理解和定位内存泄漏问题。
"""

__version__ = "0.1.0"
__author__ = "Memory Profiler Team"

from memprofiler.config import Config
from memprofiler.models import AnalysisResult, DatabaseManager
from memprofiler.readers import (
    ScriptReader,
    SnapshotReader,
    GCLogReader,
    RefJsonReader,
)
from memprofiler.analyzer import MemoryAnalyzer
from memprofiler.exporters import MarkdownExporter, JsonExporter

__all__ = [
    "Config",
    "AnalysisResult",
    "DatabaseManager",
    "ScriptReader",
    "SnapshotReader",
    "GCLogReader",
    "RefJsonReader",
    "MemoryAnalyzer",
    "MarkdownExporter",
    "JsonExporter",
]
