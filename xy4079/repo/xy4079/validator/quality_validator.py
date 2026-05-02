# -*- coding: utf-8 -*-
"""
组合校验器 - 整合所有校验规则
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from collections import defaultdict

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    QualityReport,
    IssueType,
    IssueSeverity
)
from .base_validator import BaseValidator, ValidationResult
from .point_validator import PointValidator
from .time_validator import TimeValidator
from .duplicate_validator import DuplicateValidator
from .naming_validator import NamingValidator
from .pair_validator import PairValidator


@dataclass
class FullValidationResult:
    """完整校验结果"""
    passed: bool = True
    all_results: List[ValidationResult] = field(default_factory=list)
    all_issues: List[QualityIssue] = field(default_factory=list)
    pending_review_issues: List[QualityIssue] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def critical_count(self) -> int:
        """严重问题数量"""
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.CRITICAL)
    
    @property
    def warning_count(self) -> int:
        """警告问题数量"""
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.WARNING)
    
    @property
    def info_count(self) -> int:
        """提示问题数量"""
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.INFO)


class QualityValidator:
    """组合校验器"""
    
    def __init__(
        self,
        enable_point: bool = True,
        enable_time: bool = True,
        enable_duplicate: bool = True,
        enable_naming: bool = True,
        enable_pair: bool = True,
        time_window_before: int = None,
        time_window_after: int = None
    ):
        self.validators: List[BaseValidator] = []
        
        if enable_point:
            self.validators.append(PointValidator())
        
        if enable_time:
            self.validators.append(TimeValidator(
                window_before_days=time_window_before,
                window_after_days=time_window_after
            ))
        
        if enable_duplicate:
            self.validators.append(DuplicateValidator())
        
        if enable_naming:
            self.validators.append(NamingValidator())
        
        if enable_pair:
            self.validators.append(PairValidator())
    
    def validate(
        self,
        work_order: Optional[WorkOrder],
        photos: List[Photo]
    ) -> FullValidationResult:
        """
        执行完整校验
        
        Args:
            work_order: 工单信息
            photos: 照片列表
            
        Returns:
            FullValidationResult: 完整校验结果
        """
        all_results: List[ValidationResult] = []
        all_issues: List[QualityIssue] = []
        
        # 执行每个校验器
        for validator in self.validators:
            result = validator.validate(work_order, photos)
            all_results.append(result)
            all_issues.extend(result.issues)
        
        # 确定待复核的问题
        # 严重问题和警告问题都需要人工确认
        pending_review_issues = [
            issue for issue in all_issues
            if issue.severity in (IssueSeverity.CRITICAL, IssueSeverity.WARNING)
        ]
        
        # 汇总统计
        summary = self._generate_summary(all_results, all_issues, photos)
        
        # 判断是否通过（没有严重问题即为通过）
        has_critical = any(i.severity == IssueSeverity.CRITICAL for i in all_issues)
        passed = not has_critical
        
        return FullValidationResult(
            passed=passed,
            all_results=all_results,
            all_issues=all_issues,
            pending_review_issues=pending_review_issues,
            summary=summary
        )
    
    def _generate_summary(
        self,
        results: List[ValidationResult],
        issues: List[QualityIssue],
        photos: List[Photo]
    ) -> Dict[str, Any]:
        """生成校验摘要"""
        # 按类型统计问题
        issues_by_type: Dict[IssueType, int] = defaultdict(int)
        issues_by_severity: Dict[IssueSeverity, int] = defaultdict(int)
        
        for issue in issues:
            issues_by_type[issue.issue_type] += 1
            issues_by_severity[issue.severity] += 1
        
        # 按校验器统计
        validator_stats = {}
        for result in results:
            validator_stats[result.validator_name] = {
                'passed': result.passed,
                'issues_count': len(result.issues),
                'critical_count': result.critical_count,
                'warning_count': result.warning_count,
                'info_count': result.info_count
            }
        
        return {
            'total_photos': len(photos),
            'total_issues': len(issues),
            'issues_by_type': {k.value: v for k, v in issues_by_type.items()},
            'issues_by_severity': {k.value: v for k, v in issues_by_severity.items()},
            'validator_stats': validator_stats
        }
    
    def create_quality_report(
        self,
        work_order: Optional[WorkOrder],
        photos: List[Photo],
        validation_result: FullValidationResult
    ) -> QualityReport:
        """创建质检报告"""
        report = QualityReport(
            report_id=QualityReport.generate_id(),
            work_order=work_order,
            photos_count=len(photos),
            valid_photos_count=len([p for p in photos if p.validated]),
            issues_count=len(validation_result.all_issues),
            critical_issues_count=validation_result.critical_count,
            warning_issues_count=validation_result.warning_count,
            info_issues_count=validation_result.info_count,
            issues=validation_result.all_issues,
            passed=validation_result.passed
        )
        
        # 填充点位状态
        # 从校验结果中提取点位信息
        for result in validation_result.all_results:
            if isinstance(result.info, dict):
                if 'point_counts' in result.info:
                    report.points_status = {
                        'counts': result.info.get('point_counts', {}),
                        'required': result.info.get('required_points', [])
                    }
                    break
        
        return report
