"""报告生成器基类"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TypeVar

from ..models.config import ProjectConfig
from ..models.quarantine import QuarantineStore
from ..models.violation import Violation, ViolationSummary


T = TypeVar("T")


@dataclass
class ReportResult:
    """报告生成结果"""

    success: bool = True
    message: str = ""
    errors: List[str] = field(default_factory=list)
    output_path: Optional[Path] = None
    additional_outputs: List[Path] = field(default_factory=list)
    summary: Optional[Dict[str, Any]] = None

    def add_error(self, error: str) -> None:
        """添加错误"""
        self.errors.append(error)
        self.success = False

    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0

    def add_output(self, path: Path) -> None:
        """添加额外输出文件"""
        self.additional_outputs.append(path)


class ReportGenerator(ABC):
    """报告生成器基类"""

    def __init__(
        self,
        project_config: ProjectConfig,
        quarantine_store: Optional[QuarantineStore] = None,
    ):
        """
        初始化报告生成器

        Args:
            project_config: 项目配置
            quarantine_store: 隔离存储（可选）
        """
        self.config = project_config
        self.quarantine_store = quarantine_store
        self.generated_at = datetime.now()

    @abstractmethod
    def generate(self, output_path: Optional[Path] = None) -> ReportResult:
        """
        生成报告

        Args:
            output_path: 输出路径

        Returns:
            报告生成结果
        """
        pass

    def _ensure_output_dir(self, path: Path) -> None:
        """确保输出目录存在"""
        path.parent.mkdir(parents=True, exist_ok=True)

    def _get_severity_icon(self, severity: str) -> str:
        """
        获取严重程度图标

        Args:
            severity: 严重程度

        Returns:
            图标字符
        """
        icons = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
            "info": "ℹ️",
        }
        return icons.get(severity.lower(), "⚠️")

    def _format_severity_name(self, severity: str) -> str:
        """
        格式化严重程度名称

        Args:
            severity: 严重程度

        Returns:
            格式化后的名称
        """
        names = {
            "critical": "严重",
            "high": "高",
            "medium": "中",
            "low": "低",
            "info": "信息",
        }
        return names.get(severity.lower(), severity)

    def _get_violation_category_name(self, category: str) -> str:
        """
        获取违规类别名称

        Args:
            category: 类别

        Returns:
            格式化后的名称
        """
        names = {
            "format": "格式错误",
            "frequency": "频率违规",
            "power": "功率违规",
            "scheduling": "排班冲突",
            "record": "记录缺失",
            "data": "数据问题",
        }
        return names.get(category.lower(), category)

    def _group_violations_by_severity(
        self,
        violations: List[Violation],
    ) -> Dict[str, List[Violation]]:
        """
        按严重程度分组违规

        Args:
            violations: 违规列表

        Returns:
            按严重程度分组的字典
        """
        from ..models.violation import ViolationSeverity

        grouped: Dict[str, List[Violation]] = {
            ViolationSeverity.CRITICAL.value: [],
            ViolationSeverity.HIGH.value: [],
            ViolationSeverity.MEDIUM.value: [],
            ViolationSeverity.LOW.value: [],
            ViolationSeverity.INFO.value: [],
        }

        for v in violations:
            severity = v.severity
            if isinstance(severity, str):
                key = severity
            else:
                key = severity.value

            if key in grouped:
                grouped[key].append(v)
            else:
                grouped[ViolationSeverity.MEDIUM.value].append(v)

        return grouped

    def _group_violations_by_category(
        self,
        violations: List[Violation],
    ) -> Dict[str, List[Violation]]:
        """
        按类别分组违规

        Args:
            violations: 违规列表

        Returns:
            按类别分组的字典
        """
        grouped: Dict[str, List[Violation]] = {}

        for v in violations:
            category = v.category or "other"
            if category not in grouped:
                grouped[category] = []
            grouped[category].append(v)

        return grouped

    def _calculate_statistics(
        self,
        violations: List[Violation],
    ) -> Dict[str, Any]:
        """
        计算违规统计

        Args:
            violations: 违规列表

        Returns:
            统计信息字典
        """
        from ..models.violation import ViolationSeverity

        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }

        category_counts: Dict[str, int] = {}

        for v in violations:
            severity = v.severity
            if isinstance(severity, str):
                key = severity.lower()
            else:
                key = severity.value.lower()

            if key in severity_counts:
                severity_counts[key] += 1
            else:
                severity_counts["medium"] += 1

            category = v.category or "other"
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1

        total = len(violations)
        critical = severity_counts["critical"]
        high = severity_counts["high"]

        risk_level = "低"
        if critical > 0:
            risk_level = "高"
        elif high > 0:
            risk_level = "中"

        return {
            "total_violations": total,
            "severity_counts": severity_counts,
            "category_counts": category_counts,
            "risk_level": risk_level,
            "generated_at": self.generated_at.isoformat(),
        }

    def _get_violation_summary(
        self,
        violation: Violation,
    ) -> Dict[str, Any]:
        """
        获取违规摘要

        Args:
            violation: 违规对象

        Returns:
            摘要字典
        """
        from ..models.violation import ViolationSeverity, ViolationType

        severity = violation.severity
        if isinstance(severity, str):
            severity_str = severity
        else:
            severity_str = severity.value

        violation_type = violation.violation_type
        if isinstance(violation_type, str):
            type_str = violation_type
        elif violation_type:
            type_str = violation_type.value
        else:
            type_str = "unknown"

        evidence = None
        if violation.evidence:
            evidence = {
                "field_name": violation.evidence.field_name,
                "expected_value": violation.evidence.expected_value,
                "actual_value": violation.evidence.actual_value,
                "context": violation.evidence.context,
            }

        return {
            "violation_id": violation.violation_id,
            "violation_type": type_str,
            "severity": severity_str,
            "severity_name": self._format_severity_name(severity_str),
            "severity_icon": self._get_severity_icon(severity_str),
            "category": violation.category,
            "category_name": self._get_violation_category_name(violation.category or "other"),
            "message": violation.message,
            "evidence": evidence,
            "source_file": violation.source_file,
            "line_number": violation.line_number,
            "call_sign": violation.call_sign,
            "channel_id": violation.channel_id,
            "date": violation.date,
            "time_start": violation.time_start,
            "time_end": violation.time_end,
            "status": violation.status,
        }
