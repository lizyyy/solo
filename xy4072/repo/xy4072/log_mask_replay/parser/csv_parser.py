"""CSV 格式日志解析器"""

import csv
from pathlib import Path
from typing import Any, Dict, List

from .base import BaseParser, LogEntry


class CsvParser(BaseParser):
    """CSV 格式日志解析器"""
    
    def __init__(self):
        """初始化 CSV 解析器"""
        super().__init__()
    
    def parse(self, file_path: Path) -> List[LogEntry]:
        """
        解析 CSV 格式日志文件
        
        Args:
            file_path: 日志文件路径
            
        Returns:
            解析后的日志条目列表
        """
        entries = []
        source_file = file_path.name
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                # 尝试自动检测 CSV 方言
                sniffer = csv.Sniffer()
                try:
                    dialect = sniffer.sniff(f.read(1024))
                    f.seek(0)
                    reader = csv.DictReader(f, dialect=dialect)
                except csv.Error:
                    # 如果无法自动检测，使用默认设置
                    f.seek(0)
                    reader = csv.DictReader(f)
                
                # 读取所有行
                for line_number, row in enumerate(reader, start=2):  # 从 2 开始，因为第一行是表头
                    # 转换为普通字符串以便保存
                    raw_content = ",".join([f'"{v}"' if v else "" for v in row.values()])
                    
                    # 创建日志条目
                    entry = self.create_log_entry(
                        raw_content=raw_content,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content=dict(row)
                    )
                    
                    # 尝试从 CSV 行中提取更多信息
                    self._extract_from_row(row, entry)
                    
                    entries.append(entry)
                    
        except UnicodeDecodeError:
            # 尝试使用其他编码
            with open(file_path, "r", encoding="gbk") as f:
                reader = csv.DictReader(f)
                for line_number, row in enumerate(reader, start=2):
                    raw_content = ",".join([f'"{v}"' if v else "" for v in row.values()])
                    entry = self.create_log_entry(
                        raw_content=raw_content,
                        line_number=line_number,
                        source_file=source_file,
                        parsed_content=dict(row)
                    )
                    self._extract_from_row(row, entry)
                    entries.append(entry)
        
        return entries
    
    def _extract_from_row(self, row: Dict[str, Any], entry: LogEntry) -> None:
        """
        从 CSV 行中提取额外信息
        
        Args:
            row: CSV 行数据
            entry: 日志条目
        """
        # 常见的时间戳字段名
        timestamp_fields = [
            "timestamp", "time", "datetime", "date", "created_at",
            "updated_at", "event_time", "log_time", "时间", "时间戳"
        ]
        
        # 常见的日志级别字段名
        level_fields = [
            "level", "log_level", "severity", "priority", "type",
            "级别", "日志级别"
        ]
        
        # 常见的内容字段名
        content_fields = [
            "message", "content", "msg", "text", "log",
            "消息", "内容", "日志"
        ]
        
        # 提取时间戳
        for field in timestamp_fields:
            if field in row:
                value = row[field]
                if isinstance(value, str):
                    timestamp = self.parse_timestamp(value)
                    if timestamp:
                        entry.timestamp = timestamp
                        break
        
        # 提取日志级别
        for field in level_fields:
            if field in row:
                value = row[field]
                if isinstance(value, str):
                    entry.log_level = value.upper()
                    break
        
        # 提取内容（用于敏感字段扫描）
        full_content = " ".join([str(v) for v in row.values()])
        if not entry.raw_content:
            entry.raw_content = full_content
    
    def supports_format(self, file_path: Path) -> bool:
        """
        检查是否支持该文件格式
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否支持该格式
        """
        ext = file_path.suffix.lower()
        return ext == ".csv"
