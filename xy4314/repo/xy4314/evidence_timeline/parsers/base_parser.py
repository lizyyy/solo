"""基础解析器"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List
from datetime import datetime

class BaseParser(ABC):
    """解析器基类"""
    
    @abstractmethod
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        解析文件并返回标准化的数据列表
        
        Args:
            file_path: 文件路径
            
        Returns:
            解析后的数据列表，每个元素是一个字典，包含标准字段：
            - id: 唯一标识符
            - type: 数据类型（evidence, chat, memo, transcript）
            - content: 内容
            - timestamp: 时间戳（datetime对象或None）
            - metadata: 元数据字典
        """
        pass
    
    @abstractmethod
    def supports_file(self, file_path: str) -> bool:
        """
        检查是否支持该文件类型
        
        Args:
            file_path: 文件路径
            
        Returns:
            是否支持
        """
        pass
    
    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """
        解析时间戳字符串
        
        Args:
            timestamp_str: 时间戳字符串
            
        Returns:
            datetime对象
        """
        from dateutil import parser
        return parser.parse(timestamp_str)
