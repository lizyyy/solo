"""校验结果数据模型"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ValidationSeverity(str, Enum):
    """校验严重程度"""
    INFO = "信息"
    WARNING = "警告"
    ERROR = "错误"
    CRITICAL = "严重错误"


class ValidationCategory(str, Enum):
    """校验类别"""
    POWER_RANGE = "度数范围"
    CYLINDER_FORMAT = "柱镜格式"
    AXIS_VALIDATION = "轴位校验"
    AXIS_SWAP = "轴位互换风险"
    PD_VALIDATION = "瞳距校验"
    PH_VALIDATION = "瞳高校验"
    PD_FRAME_MATCH = "瞳距镜架匹配"
    INVENTORY_AVAILABILITY = "库存可用性"
    DUPLICATE_ORDER = "重复订单"
    DATA_FORMAT = "数据格式"
    OTHER = "其他"


class ValidationIssue(BaseModel):
    """校验问题"""
    
    issue_id: str = Field(description="问题唯一标识")
    category: ValidationCategory = Field(description="问题类别")
    severity: ValidationSeverity = Field(description="严重程度")
    
    message: str = Field(description="问题描述")
    detail: Optional[str] = Field(default=None, description="详细说明")
    
    location: Optional[str] = Field(default=None, description="问题位置")
    affected_field: Optional[str] = Field(default=None, description="受影响字段")
    
    suggested_fix: Optional[str] = Field(default=None, description="建议修复方案")
    reference_value: Optional[Any] = Field(default=None, description="参考值")
    actual_value: Optional[Any] = Field(default=None, description="实际值")
    
    created_at: datetime = Field(default_factory=datetime.now, description="发现时间")
    
    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "issue_id": self.issue_id,
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "detail": self.detail,
            "location": self.location,
            "affected_field": self.affected_field,
            "suggested_fix": self.suggested_fix,
            "reference_value": self.reference_value,
            "actual_value": self.actual_value,
        }


class ValidationResult(BaseModel):
    """校验结果"""
    
    order_id: str = Field(description="订单ID")
    prescription_id: str = Field(description="处方ID")
    
    passed: bool = Field(default=True, description="是否通过校验")
    
    issues: list[ValidationIssue] = Field(default_factory=list, description="问题列表")
    
    checked_at: datetime = Field(default_factory=datetime.now, description="校验时间")
    checker: Optional[str] = Field(default=None, description="校验人")
    
    stats: dict = Field(default_factory=dict, description="统计信息")
    
    @property
    def error_count(self) -> int:
        """错误数量"""
        return sum(1 for i in self.issues if i.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL])
    
    @property
    def warning_count(self) -> int:
        """警告数量"""
        return sum(1 for i in self.issues if i.severity == ValidationSeverity.WARNING)
    
    @property
    def info_count(self) -> int:
        """信息数量"""
        return sum(1 for i in self.issues if i.severity == ValidationSeverity.INFO)
    
    def add_issue(self, issue: ValidationIssue) -> None:
        """添加问题"""
        self.issues.append(issue)
        if issue.severity in [ValidationSeverity.ERROR, ValidationSeverity.CRITICAL]:
            self.passed = False
    
    def get_issues_by_severity(self, severity: ValidationSeverity) -> list[ValidationIssue]:
        """按严重程度获取问题"""
        return [i for i in self.issues if i.severity == severity]
    
    def get_issues_by_category(self, category: ValidationCategory) -> list[ValidationIssue]:
        """按类别获取问题"""
        return [i for i in self.issues if i.category == category]
    
    def to_summary(self) -> dict:
        """获取摘要"""
        return {
            "order_id": self.order_id,
            "prescription_id": self.prescription_id,
            "passed": self.passed,
            "checked_at": self.checked_at.isoformat(),
            "total_issues": len(self.issues),
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "info_count": self.info_count,
            "stats": self.stats,
        }
    
    def to_dict(self) -> dict:
        """转换为完整字典"""
        return {
            **self.to_summary(),
            "issues": [i.to_dict() for i in self.issues],
        }
    
    def get_markdown_report(self) -> str:
        """生成Markdown格式的校验报告"""
        lines = []
        lines.append(f"# 校验报告 - 订单 {self.order_id}\n")
        lines.append(f"- **处方ID**: {self.prescription_id}")
        lines.append(f"- **校验时间**: {self.checked_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **校验结果**: {'✅ 通过' if self.passed else '❌ 未通过'}\n")
        
        lines.append("## 统计信息\n")
        lines.append(f"- 错误: {self.error_count} 个")
        lines.append(f"- 警告: {self.warning_count} 个")
        lines.append(f"- 信息: {self.info_count} 个\n")
        
        if self.issues:
            lines.append("## 问题详情\n")
            
            errors = self.get_issues_by_severity(ValidationSeverity.ERROR)
            criticals = self.get_issues_by_severity(ValidationSeverity.CRITICAL)
            
            if criticals or errors:
                lines.append("### ❌ 错误\n")
                for issue in criticals + errors:
                    lines.append(f"#### [{issue.category.value}] {issue.message}\n")
                    if issue.detail:
                        lines.append(f"- 详情: {issue.detail}")
                    if issue.affected_field:
                        lines.append(f"- 字段: {issue.affected_field}")
                    if issue.actual_value is not None:
                        lines.append(f"- 实际值: {issue.actual_value}")
                    if issue.reference_value is not None:
                        lines.append(f"- 参考值: {issue.reference_value}")
                    if issue.suggested_fix:
                        lines.append(f"- 建议: {issue.suggested_fix}")
                    lines.append("")
            
            warnings = self.get_issues_by_severity(ValidationSeverity.WARNING)
            if warnings:
                lines.append("### ⚠️ 警告\n")
                for issue in warnings:
                    lines.append(f"#### [{issue.category.value}] {issue.message}\n")
                    if issue.detail:
                        lines.append(f"- 详情: {issue.detail}")
                    if issue.suggested_fix:
                        lines.append(f"- 建议: {issue.suggested_fix}")
                    lines.append("")
            
            infos = self.get_issues_by_severity(ValidationSeverity.INFO)
            if infos:
                lines.append("### ℹ️ 信息\n")
                for issue in infos:
                    lines.append(f"- [{issue.category.value}] {issue.message}")
                lines.append("")
        
        return "\n".join(lines)


class BatchValidationResult(BaseModel):
    """批量校验结果"""
    
    batch_id: str = Field(description="批次ID")
    total_orders: int = Field(description="总订单数")
    
    passed_count: int = Field(default=0, description="通过数量")
    failed_count: int = Field(default=0, description="未通过数量")
    
    results: list[ValidationResult] = Field(default_factory=list, description="各订单校验结果")
    
    started_at: datetime = Field(default_factory=datetime.now, description="开始时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    
    @property
    def total_errors(self) -> int:
        """总错误数"""
        return sum(r.error_count for r in self.results)
    
    @property
    def total_warnings(self) -> int:
        """总警告数"""
        return sum(r.warning_count for r in self.results)
    
    def add_result(self, result: ValidationResult) -> None:
        """添加校验结果"""
        self.results.append(result)
        if result.passed:
            self.passed_count += 1
        else:
            self.failed_count += 1
    
    def get_failed_orders(self) -> list[ValidationResult]:
        """获取未通过的订单"""
        return [r for r in self.results if not r.passed]
    
    def to_summary(self) -> dict:
        """获取摘要"""
        return {
            "batch_id": self.batch_id,
            "total_orders": self.total_orders,
            "passed_count": self.passed_count,
            "failed_count": self.failed_count,
            "total_errors": self.total_errors,
            "total_warnings": self.total_warnings,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
