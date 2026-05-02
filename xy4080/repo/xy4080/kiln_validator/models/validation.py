"""校验结果数据模型"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Any

from pydantic import BaseModel, Field


class IssueSeverity(str, Enum):
    """问题严重程度"""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueCategory(str, Enum):
    """问题类别"""

    RAMP_RATE = "ramp_rate"
    SOAK_TIME = "soak_time"
    COOLING_RATE = "cooling_rate"
    PROBE_DRIFT = "probe_drift"
    THICKNESS_CONFLICT = "thickness_conflict"
    GLAZE_COMPATIBILITY = "glaze_compatibility"
    THERMAL_DELTA = "thermal_delta"


class ValidationIssue(BaseModel):
    """单个校验问题"""

    category: IssueCategory = Field(description="问题类别")
    severity: IssueSeverity = Field(description="严重程度")
    message: str = Field(description="问题描述")
    location_minutes: Optional[int] = Field(default=None, description="发生位置(分钟)")
    location_segment: Optional[str] = Field(default=None, description="发生位置(段名)")
    details: dict[str, Any] = Field(default_factory=dict, description="详细数据")
    suggestion: Optional[str] = Field(default=None, description="修复建议")

    @property
    def is_critical(self) -> bool:
        return self.severity == IssueSeverity.CRITICAL

    @property
    def is_warning(self) -> bool:
        return self.severity == IssueSeverity.WARNING


class ValidationResult(BaseModel):
    """完整校验结果"""

    timestamp: datetime = Field(default_factory=datetime.now, description="校验时间")
    plan_name: str = Field(description="烧成计划名称")
    workpiece_count: int = Field(description="作品数量")
    issues: List[ValidationIssue] = Field(default_factory=list, description="问题列表")

    @property
    def has_critical(self) -> bool:
        """是否存在严重问题"""
        return any(issue.is_critical for issue in self.issues)

    @property
    def has_warnings(self) -> bool:
        """是否存在警告"""
        return any(issue.is_warning for issue in self.issues)

    @property
    def total_issues(self) -> int:
        return len(self.issues)

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.issues if i.is_critical)

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.is_warning)

    @property
    def info_count(self) -> int:
        return sum(
            1 for i in self.issues if i.severity == IssueSeverity.INFO
        )

    def get_issues_by_category(self, category: IssueCategory) -> List[ValidationIssue]:
        """按类别筛选问题"""
        return [i for i in self.issues if i.category == category]

    def get_critical_issues(self) -> List[ValidationIssue]:
        """获取所有严重问题"""
        return [i for i in self.issues if i.is_critical]

    def get_warning_issues(self) -> List[ValidationIssue]:
        """获取所有警告"""
        return [i for i in self.issues if i.is_warning]

    def add_issue(
        self,
        category: IssueCategory,
        severity: IssueSeverity,
        message: str,
        location_minutes: Optional[int] = None,
        location_segment: Optional[str] = None,
        details: Optional[dict] = None,
        suggestion: Optional[str] = None,
    ) -> None:
        """添加一个问题"""
        self.issues.append(
            ValidationIssue(
                category=category,
                severity=severity,
                message=message,
                location_minutes=location_minutes,
                location_segment=location_segment,
                details=details or {},
                suggestion=suggestion,
            )
        )
