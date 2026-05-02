"""JSONL 格式日志解析器"""

import json
from pathlib import Path
from typing import Any, Dict, List

from .base import BaseParser, LogEntry


class JsonlParser(BaseParser):
    """JSONL 格式日志解析器"""
    
    def __init__(self):
        """初始化 JSONL 解析器"""
        super().__init__()
    
    def parse(self, file_path: Path) -> List[LogEntry]:
        """
        解析 JSONL 格式日志文件
        
        Args:
            file_path: 日志文件路径
            
        Returns:
            解析后的日志条目列表
        """
        entries = []
        source_file = file_path.name
        
        with open(file_path, "r", encoding="utf-8") as f:
            for line_number, line in enumerate(f, start=1):
                stripped_line = line.rstrip()
                if not stripped_line:
                    continue
                
                try:
                    # 解析 JSON
                    parsed_content = json.loads(stripped_line)
                    
                    # 创建日志条目
                    entry = self.create_log_entry(
                        raw_content=stripped_line,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content=parsed_content
                    )
                    
                    # 尝试从解析的内容中提取更多信息
                    self._extract_from_json(parsed_content, entry)
                    
                    entries.append(entry)
                    
                except json.JSONDecodeError:
                    # 如果解析失败，当作普通文本处理
                    entry = self.create_log_entry(
                        raw_content=stripped_line,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content={"content": stripped_line}
                    )
                    entries.append(entry)
        
        return entries
    
    def _extract_from_json(self, parsed_content: Dict[str, Any], entry: LogEntry) -> None:
        """
        从 JSON 内容中提取额外信息
        
        Args:
            parsed_content: 解析后的 JSON 内容
            entry: 日志条目
        """
        # 常见的时间戳字段名
        timestamp_fields = [
            "timestamp", "time", "@timestamp", "datetime", "date",
            "created_at", "updated_at", "event_time", "log_time"
        ]
        
        # 常见的日志级别字段名
        level_fields = [
            "level", "log_level", "severity", "priority", "type"
        ]
        
        # 提取时间戳
        for field in timestamp_fields:
            if field in parsed_content:
                value = parsed_content[field]
                if isinstance(value, str):
                    timestamp = self.parse_timestamp(value)
                    if timestamp:
                        entry.timestamp = timestamp
                        break
                elif isinstance(value, (int, float)):
                    # 尝试将 Unix 时间戳转换为 datetime
                    try:
                        from datetime import datetime
                        if value > 1e12:  # 毫秒级时间戳
                            entry.timestamp = datetime.fromtimestamp(value / 1000)
                        else:  # 秒级时间戳
                            entry.timestamp = datetime.fromtimestamp(value)
                        break
                    except (ValueError, OSError):
                        continue
        
        # 提取日志级别
        for field in level_fields:
            if field in parsed_content:
                value = parsed_content[field]
                if isinstance(value, str):
                    entry.log_level = value.upper()
                    break
    
    def supports_format(self, file_path: Path) -> bool:
        """
        检查是否支持该文件格式
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否支持该格式
        """
        ext = file_path.suffix.lower()
        return ext == ".jsonl" or ext == ".json"
