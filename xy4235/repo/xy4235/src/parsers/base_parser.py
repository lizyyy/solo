from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, List
from datetime import datetime


@dataclass
class ParseResult:
    """
    解析结果
    """
    success: bool = True
    data: Any = None
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    parse_time: datetime = None
    
    def __post_init__(self):
        if self.parse_time is None:
            self.parse_time = datetime.now()
    
    def add_error(self, error: str):
        """
        添加错误
        """
        self.errors.append(error)
        self.success = False
    
    def add_warning(self, warning: str):
        """
        添加警告
        """
        self.warnings.append(warning)


class BaseParser(ABC):
    """
    基础解析器抽象类
    """
    
    def __init__(self):
        self.result = ParseResult()
    
    @abstractmethod
    def parse(self, file_path: str) -> ParseResult:
        """
        解析文件
        """
        pass
    
    @abstractmethod
    def can_parse(self, file_path: str) -> bool:
        """
        检查是否能解析该文件
        """
        pass
