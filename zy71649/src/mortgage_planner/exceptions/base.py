"""异常基类和分类系统"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from uuid import uuid4


class ErrorCategory(str, Enum):
    """异常分类"""
    DATA_ERROR = "data_error"
    RULE_ERROR = "rule_error"
    MATERIAL_ERROR = "material_error"
    SYSTEM_ERROR = "system_error"

    @property
    def label(self) -> str:
        labels = {
            self.DATA_ERROR: "📊 数据问题",
            self.RULE_ERROR: "⚙️ 规则问题",
            self.MATERIAL_ERROR: "📋 材料缺失",
            self.SYSTEM_ERROR: "🔧 系统问题",
        }
        return labels[self]

    @property
    def color(self) -> str:
        colors = {
            self.DATA_ERROR: "yellow",
            self.RULE_ERROR: "red",
            self.MATERIAL_ERROR: "blue",
            self.SYSTEM_ERROR: "magenta",
        }
        return colors[self]

    @property
    def description(self) -> str:
        descriptions = {
            self.DATA_ERROR: "数据录入错误、格式不正确、数值异常或字段缺失等",
            self.RULE_ERROR: "违反贷款规则、违约金规则、提前还款限制等业务规则",
            self.MATERIAL_ERROR: "必要材料未提供、数据不完整、等待客户确认等",
            self.SYSTEM_ERROR: "程序内部错误、配置问题等技术故障",
        }
        return descriptions[self]


class ErrorSeverity(str, Enum):
    """异常严重程度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

    @property
    def icon(self) -> str:
        icons = {
            self.INFO: "ℹ️",
            self.WARNING: "⚠️",
            self.ERROR: "❌",
            self.CRITICAL: "🔥",
        }
        return icons[self]


class ErrorContext:
    """错误上下文"""
    def __init__(
        self,
        field: Optional[str] = None,
        value: Any = None,
        expected: Optional[str] = None,
        source: Optional[str] = None,
        record_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        contract_no: Optional[str] = None,
        suggestions: Optional[List[str]] = None,
        **kwargs,
    ):
        self.id = uuid4().hex[:8]
        self.timestamp = datetime.now()
        self.field = field
        self.value = value
        self.expected = expected
        self.source = source
        self.record_id = record_id
        self.customer_id = customer_id
        self.contract_no = contract_no
        self.suggestions = suggestions or []
        self.extra = kwargs

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "field": self.field,
            "value": str(self.value) if self.value is not None else None,
            "expected": self.expected,
            "source": self.source,
            "record_id": self.record_id,
            "customer_id": self.customer_id,
            "contract_no": self.contract_no,
            "suggestions": self.suggestions,
            **self.extra,
        }

    def __repr__(self) -> str:
        parts = []
        if self.field:
            parts.append(f"字段: {self.field}")
        if self.value is not None:
            parts.append(f"值: {self.value}")
        if self.expected:
            parts.append(f"期望: {self.expected}")
        if self.source:
            parts.append(f"来源: {self.source}")
        return f"ErrorContext({', '.join(parts)})"


class MortgageException(Exception):
    """房贷规划异常基类"""
    category: ErrorCategory = ErrorCategory.SYSTEM_ERROR
    severity: ErrorSeverity = ErrorSeverity.ERROR
    default_message: str = "发生未知错误"

    def __init__(
        self,
        message: Optional[str] = None,
        context: Optional[ErrorContext] = None,
        **kwargs,
    ):
        self.message = message or self.default_message
        self.context = context or ErrorContext(**kwargs)
        super().__init__(self.message)

    @property
    def category_label(self) -> str:
        return self.category.label

    @property
    def severity_icon(self) -> str:
        return self.severity.icon

    def format_for_console(self) -> str:
        """格式化为控制台输出"""
        from .handler import format_error_message
        return format_error_message(self)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "error_type": self.__class__.__name__,
            "category": self.category.value,
            "category_label": self.category_label,
            "severity": self.severity.value,
            "severity_icon": self.severity_icon,
            "message": self.message,
            "context": self.context.to_dict(),
            "category_description": self.category.description,
        }

    def __str__(self) -> str:
        return f"{self.severity_icon} {self.category_label}: {self.message}"

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(message='{self.message}', category={self.category})"
