"""解析器基类"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class BaseParser(ABC):
    """解析器基类"""
    
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
    @abstractmethod
    def parse(self) -> Any:
        """解析文件并返回数据"""
        pass
    
    @abstractmethod
    def validate(self) -> bool:
        """验证数据有效性"""
        pass
    
    def add_error(self, message: str):
        """添加错误"""
        logger.error(f"{self.__class__.__name__}: {message}")
        self.errors.append(message)
    
    def add_warning(self, message: str):
        """添加警告"""
        logger.warning(f"{self.__class__.__name__}: {message}")
        self.warnings.append(message)
    
    def get_errors(self) -> List[str]:
        """获取所有错误"""
        return self.errors.copy()
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings.copy()
    
    def has_errors(self) -> bool:
        """检查是否有错误"""
        return len(self.errors) > 0
