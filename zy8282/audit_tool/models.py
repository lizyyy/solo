"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional


class IssueType(Enum):
    """问题类型枚举"""
    TOLERANCE_EXCEEDED = "容差超出"
    ROUNDING_INCONSISTENCY = "四舍五入不一致"
    MISSING_REFUND_DEDUCTION = "漏扣退款"
    STORE_AGGREGATION_ERROR = "门店汇总方向错误"
    MISSING_METRIC = "缺失指标"
    EXTRA_METRIC = "额外指标"
    CALCULATION_ERROR = "计算错误"


@dataclass
class Order:
    """订单数据模型"""
    order_id: str
    store_id: str
    store_name: str
    order_date: date
    order_time: str
    total_amount: Decimal
    items_count: int
    customer_id: Optional[str] = None
    payment_method: Optional[str] = None


@dataclass
class Refund:
    """退款数据模型"""
    refund_id: str
    order_id: str
    store_id: str
    refund_date: date
    refund_amount: Decimal
    refund_reason: Optional[str] = None


@dataclass
class LaborCost:
    """人工成本数据模型"""
    store_id: str
    store_name: str
    date: date
    hours_worked: Decimal
    hourly_rate: Decimal
    total_cost: Decimal
    role: Optional[str] = None


@dataclass
class MetricRule:
    """指标计算规则"""
    metric_name: str
    display_name: str
    formula: str
    description: str
    tolerance: float = 0.01
    rounding_method: str = "ROUND_HALF_UP"
    decimal_places: int = 2
    store_aggregation: str = "SUM"


@dataclass
class CalculatedMetric:
    """计算出的指标"""
    metric_name: str
    display_name: str
    value: Decimal
    store_breakdown: Dict[str, Decimal] = field(default_factory=dict)


@dataclass
class ReportMetric:
    """报告中提取的指标"""
    metric_name: str
    display_name: str
    value: Decimal
    source_text: str
    line_number: Optional[int] = None
    store_breakdown: Optional[Dict[str, Decimal]] = None


@dataclass
class Issue:
    """发现的问题"""
    issue_type: IssueType
    metric_name: str
    message: str
    expected_value: Optional[Decimal] = None
    reported_value: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    store_id: Optional[str] = None
    context: Optional[str] = None


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    total_issues: int
    critical_issues: int
    warning_issues: int
    issues: List[Issue]
    calculated_metrics: List[CalculatedMetric]
    report_metrics: List[ReportMetric]


@dataclass
class AuditContext:
    """审计上下文"""
    orders: List[Order]
    refunds: List[Refund]
    labor_costs: List[LaborCost]
    metric_rules: Dict[str, MetricRule]
    report_content: Any
    report_type: str  # 'markdown' or 'json'
    store_ids: List[str] = field(default_factory=list)
    date_range: Optional[tuple] = None
