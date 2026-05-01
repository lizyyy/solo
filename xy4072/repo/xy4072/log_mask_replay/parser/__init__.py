"""解析器模块 - 支持 txt/jsonl/csv 格式日志解析"""

from .base import BaseParser, LogEntry, LogFormat, detect_format
from .csv_parser import CsvParser
from .jsonl_parser import JsonlParser
from .txt_parser import TxtParser


def get_parser(file_path: str) -> BaseParser:
    """
    根据文件路径获取合适的解析器
    
    Args:
        file_path: 文件路径
        
    Returns:
        对应的解析器实例
    """
    from pathlib import Path
    
    path = Path(file_path)
    format_type = detect_format(path)
    
    if format_type == LogFormat.JSONL:
        return JsonlParser()
    elif format_type == LogFormat.CSV:
        return CsvParser()
    else:
        return TxtParser()


__all__ = [
    "BaseParser",
    "LogEntry",
    "LogFormat",
    "detect_format",
    "TxtParser",
    "JsonlParser",
    "CsvParser",
    "get_parser",
]
