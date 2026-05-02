"""
基础解析器
定义解析器接口和通用功能
"""

from abc import ABC, abstractmethod
from typing import Any, List, Dict
import os


class BaseParser(ABC):
    """基础解析器抽象类"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
    
    @abstractmethod
    def parse(self, file_path: str) -> Any:
        """
        解析文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            解析后的数据对象
            
        Raises:
            ValueError: 当文件格式不正确时
            FileNotFoundError: 当文件不存在时
        """
        pass
    
    def validate_file(self, file_path: str) -> bool:
        """
        验证文件是否存在且可读
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件是否有效
        """
        if not os.path.exists(file_path):
            self.errors.append(f"文件不存在: {file_path}")
            return False
        
        if not os.path.isfile(file_path):
            self.errors.append(f"路径不是文件: {file_path}")
            return False
        
        if not os.access(file_path, os.R_OK):
            self.errors.append(f"文件不可读: {file_path}")
            return False
        
        return True
    
    def add_error(self, message: str):
        """添加错误"""
        self.errors.append(message)
    
    def add_warning(self, message: str):
        """添加警告"""
        self.warnings.append(message)
    
    def get_errors(self) -> List[str]:
        """获取所有错误"""
        return self.errors.copy()
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings.copy()
    
    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0
    
    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0
    
    def clear(self):
        """清除错误和警告"""
        self.errors.clear()
        self.warnings.clear()
