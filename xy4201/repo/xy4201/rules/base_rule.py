"""
基础规则
定义规则接口和通用功能
"""

from abc import ABC, abstractmethod
from typing import Any, List, Dict
from ..models import Risk


class BaseRule(ABC):
    """基础规则抽象类"""
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.warnings: List[str] = []
        self.errors: List[str] = []
    
    @abstractmethod
    def check(self, data: Any) -> List[Risk]:
        """
        执行规则检查
        
        Args:
            data: 要检查的数据
            
        Returns:
            检测到的风险列表
        """
        pass
    
    def add_warning(self, message: str):
        """添加警告"""
        self.warnings.append(message)
    
    def add_error(self, message: str):
        """添加错误"""
        self.errors.append(message)
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings.copy()
    
    def get_errors(self) -> List[str]:
        """获取所有错误"""
        return self.errors.copy()
    
    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0
    
    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0
    
    def clear(self):
        """清除警告和错误"""
        self.warnings.clear()
        self.errors.clear()
