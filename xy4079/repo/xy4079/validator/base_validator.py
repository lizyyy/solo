# -*- coding: utf-8 -*-
"""
基础校验器
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from collections import defaultdict

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity,
    InspectionPoint
)


@dataclass
class ValidationResult:
    """校验结果"""
    validator_name: str = ""
    passed: bool = True
    issues: List[QualityIssue] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    info: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def critical_count(self) -> int:
        """严重问题数量"""
        return sum(1 for i in self.issues if i.severity == IssueSeverity.CRITICAL)
    
    @property
    def warning_count(self) -> int:
        """警告问题数量"""
        return sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
    
    @property
    def info_count(self) -> int:
        """提示问题数量"""
        return sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)


class BaseValidator(ABC):
    """校验器基类"""
    
    validator_name: str = "BaseValidator"
    
    def __init__(self):
        self._issues: List[QualityIssue] = []
    
    @abstractmethod
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        执行校验
        
        Args:
            work_order: 工单信息（可选）
            photos: 照片列表
            
        Returns:
            ValidationResult: 校验结果
        """
        pass
    
    def _create_issue(
        self,
        issue_type: IssueType,
        description: str,
        severity: IssueSeverity = IssueSeverity.WARNING,
        related_photo_ids: List[str] = None,
        related_work_order_id: str = None
    ) -> QualityIssue:
        """创建质检问题"""
        issue = QualityIssue(
            issue_id=QualityIssue.generate_id(),
            issue_type=issue_type,
            severity=severity,
            description=description,
            related_photo_ids=related_photo_ids or [],
            related_work_order_id=related_work_order_id,
            created_at=datetime.now()
        )
        return issue
    
    def _create_result(
        self,
        issues: List[QualityIssue],
        passed: bool = None,
        warnings: List[str] = None,
        info: Dict[str, Any] = None
    ) -> ValidationResult:
        """创建校验结果"""
        if passed is None:
            # 如果有严重问题，则不通过
            passed = all(i.severity != IssueSeverity.CRITICAL for i in issues)
        
        return ValidationResult(
            validator_name=self.validator_name,
            passed=passed,
            issues=issues,
            warnings=warnings or [],
            info=info or {}
        )
