"""基础解析器模块 - 定义解析器基类和日志条目模型"""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class LogFormat(str, Enum):
    """日志格式枚举"""
    TXT = "txt"
    JSONL = "jsonl"
    CSV = "csv"
    UNKNOWN = "unknown"


@dataclass
class LogEntry:
    """日志条目数据模型"""
    raw_content: str
    parsed_content: Dict[str, Any]
    line_number: int
    source_file: str
    timestamp: Optional[datetime] = None
    log_level: Optional[str] = None
    sensitive_fields: Dict[str, List[str]] = field(default_factory=dict)
    masked_content: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "raw_content": self.raw_content,
            "parsed_content": self.parsed_content,
            "line_number": self.line_number,
            "source_file": self.source_file,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "log_level": self.log_level,
            "sensitive_fields": self.sensitive_fields,
            "masked_content": self.masked_content,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LogEntry":
        """从字典创建日志条目"""
        timestamp = None
        if data.get("timestamp"):
            try:
                timestamp = datetime.fromisoformat(data["timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            raw_content=data.get("raw_content", ""),
            parsed_content=data.get("parsed_content", {}),
            line_number=data.get("line_number", 0),
            source_file=data.get("source_file", ""),
            timestamp=timestamp,
            log_level=data.get("log_level"),
            sensitive_fields=data.get("sensitive_fields", {}),
            masked_content=data.get("masked_content"),
        )


class BaseParser(ABC):
    """解析器基类"""
    
    def __init__(self):
        """初始化解析器"""
        self.timestamp_patterns = [
            re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?"),  # ISO 8601
            re.compile(r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?"),  # 标准日期时间格式
            re.compile(r"\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}"),  # 美国格式
            re.compile(r"\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}"),  # 欧洲格式
        ]
        
        self.log_level_patterns = [
            re.compile(r"\b(DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|CRITICAL|FATAL)\b", re.IGNORECASE),
            re.compile(r"\[?(DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|CRITICAL|FATAL)\]?", re.IGNORECASE),
        ]
    
    @abstractmethod
    def parse(self, file_path: Path) -> List[LogEntry]:
        """
        解析日志文件
        
        Args:
            file_path: 日志文件路径
            
        Returns:
            解析后的日志条目列表
        """
        pass
    
    @abstractmethod
    def supports_format(self, file_path: Path) -> bool:
        """
        检查是否支持该文件格式
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否支持该格式
        """
        pass
    
    def parse_timestamp(self, content: str) -> Optional[datetime]:
        """
        从日志内容中解析时间戳
        
        Args:
            content: 日志内容
            
        Returns:
            解析出的时间戳，如果没有则返回 None
        """
        for pattern in self.timestamp_patterns:
            match = pattern.search(content)
            if match:
                timestamp_str = match.group()
                try:
                    # 尝试解析 ISO 8601 格式
                    if "T" in timestamp_str or "Z" in timestamp_str or "+" in timestamp_str or "-" in timestamp_str[-6:]:
                        return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
                    
                    # 尝试解析标准日期时间格式
                    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%d/%m/%Y %H:%M:%S", "%d-%m-%Y %H:%M:%S"]:
                        try:
                            return datetime.strptime(timestamp_str, fmt)
                        except ValueError:
                            continue
                except ValueError:
                    continue
        return None
    
    def parse_log_level(self, content: str) -> Optional[str]:
        """
        从日志内容中解析日志级别
        
        Args:
            content: 日志内容
            
        Returns:
            解析出的日志级别，如果没有则返回 None
        """
        for pattern in self.log_level_patterns:
            match = pattern.search(content)
            if match:
                return match.group(1).upper()
        return None
    
    def create_log_entry(
        self,
        raw_content: str,
        line_number: int,
        source_file: str,
        parsed_content: Optional[Dict[str, Any]] = None
    ) -> LogEntry:
        """
        创建日志条目
        
        Args:
            raw_content: 原始日志内容
            line_number: 行号
            source_file: 源文件名
            parsed_content: 解析后的内容（可选）
            
        Returns:
            日志条目
        """
        return LogEntry(
            raw_content=raw_content,
            parsed_content=parsed_content or {},
            line_number=line_number,
            source_file=source_file,
            timestamp=self.parse_timestamp(raw_content),
            log_level=self.parse_log_level(raw_content),
        )


def detect_format(file_path: Path) -> LogFormat:
    """
    根据文件扩展名检测日志格式
    
    Args:
        file_path: 文件路径
        
    Returns:
        检测到的日志格式
    """
    ext = file_path.suffix.lower()
    
    if ext == ".txt":
        return LogFormat.TXT
    elif ext == ".jsonl":
        return LogFormat.JSONL
    elif ext == ".csv":
        return LogFormat.CSV
    else:
        # 尝试通过文件内容检测
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                first_line = f.readline().strip()
                
                # 检查是否是 JSON 格式
                if first_line.startswith("{") and first_line.endswith("}"):
                    return LogFormat.JSONL
                
                # 检查是否是 CSV 格式
                if "," in first_line and not first_line.startswith("{"):
                    # 简单检查：如果有逗号且不是 JSON，可能是 CSV
                    return LogFormat.CSV
                
                # 默认是文本格式
                return LogFormat.TXT
        except (IOError, UnicodeDecodeError):
            return LogFormat.UNKNOWN
