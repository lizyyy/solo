"""规则基类"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class Severity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Issue:
    """问题描述"""
    rule_name: str
    severity: Severity
    description: str
    location: str = ""
    evidence_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "rule_name": self.rule_name,
            "severity": self.severity.value,
            "description": self.description,
            "location": self.location,
            "evidence_id": self.evidence_id,
            "details": self.details
        }


class BaseRule(ABC):
    """规则基类"""
    
    def __init__(self, name: str, description: str, severity: Severity = Severity.HIGH):
        self.name = name
        self.description = description
        self.severity = severity
    
    @abstractmethod
    def check(self, data: List[Dict[str, Any]]) -> List[Issue]:
        """
        执行规则检查
        
        Args:
            data: 解析后的数据列表
            
        Returns:
            问题列表
        """
        pass
    
    def _create_issue(
        self, 
        description: str, 
        location: str = "", 
        evidence_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: Optional[Severity] = None
    ) -> Issue:
        """
        创建问题实例
        
        Args:
            description: 问题描述
            location: 问题位置
            evidence_id: 关联的证据ID
            details: 详细信息
            severity: 严重程度（覆盖默认值）
            
        Returns:
            Issue实例
        """
        return Issue(
            rule_name=self.name,
            severity=severity or self.severity,
            description=description,
            location=location,
            evidence_id=evidence_id,
            details=details or {}
        )
