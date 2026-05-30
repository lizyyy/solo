"""数据模型定义 - 航班超售系统核心数据结构。"""
from __future__ import annotations

from datetime import datetime, date
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator
from dateutil import parser


class CabinClass(str, Enum):
    """舱位等级枚举。"""
    FIRST = "F"
    BUSINESS = "C"
    PREMIUM_ECONOMY = "W"
    ECONOMY = "Y"


class CompensateRule(BaseModel):
    """补偿规则。"""
    rule_id: str
    cabin_class: CabinClass
    threshold_hours: float = Field(description="航班起飞前小时数阈值")
    compensation_amount: float = Field(description="补偿金额（元）")
    voucher_amount: float = Field(default=0, description="代金券金额（元）")
    priority_booking: bool = Field(default=False, description="是否优先预订后续航班")


class FlightOrder(BaseModel):
    """航班订单。"""
    order_id: str
    flight_no: str
    flight_date: date
    passenger_name: str
    passenger_id: Optional[str] = None
    cabin_class: CabinClass
    fare_amount: float
    booking_date: date
    status: str = Field(default="confirmed", description="订单状态: confirmed, cancelled, no_show, boarded")

    @field_validator("flight_date", "booking_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        """智能解析多种日期格式。"""
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            try:
                return parser.parse(v, dayfirst=False).date()
            except (parser.ParserError, ValueError):
                try:
                    return parser.parse(v, dayfirst=True).date()
                except Exception as e:
                    raise ValueError(f"无法解析日期: {v}, 错误: {e}")
        raise ValueError(f"不支持的日期类型: {type(v)}")


class NoShowHistory(BaseModel):
    """旅客爽约历史记录。"""
    history_id: str
    passenger_name: str
    passenger_id: Optional[str] = None
    flight_date: date
    flight_no: str
    was_no_show: bool
    reason: Optional[str] = None

    @field_validator("flight_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            try:
                return parser.parse(v, dayfirst=False).date()
            except Exception:
                return parser.parse(v, dayfirst=True).date()
        raise ValueError(f"不支持的日期类型: {type(v)}")


class FlightInfo(BaseModel):
    """航班基础信息。"""
    flight_no: str
    flight_date: date
    departure: str
    arrival: str
    scheduled_departure: datetime
    capacity: Dict[CabinClass, int] = Field(description="各舱位总座位数")

    @field_validator("flight_date", mode="before")
    @classmethod
    def parse_flight_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            try:
                return parser.parse(v, dayfirst=False).date()
            except Exception:
                return parser.parse(v, dayfirst=True).date()
        raise ValueError(f"不支持的日期类型: {type(v)}")

    @field_validator("scheduled_departure", mode="before")
    @classmethod
    def parse_datetime(cls, v: Any) -> datetime:
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return parser.parse(v, dayfirst=False)
            except Exception:
                return parser.parse(v, dayfirst=True)
        raise ValueError(f"不支持的时间类型: {type(v)}")


class Passenger(BaseModel):
    """旅客信息。"""
    passenger_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    tier: str = Field(default="basic", description="会员等级: basic, silver, gold, platinum")
    historical_no_show_count: int = Field(default=0)
    historical_flight_count: int = Field(default=0)


class OptimizationRequest(BaseModel):
    """优化请求。"""
    request_id: str
    flight_no: str
    flight_date: date
    created_at: datetime = Field(default_factory=datetime.now)
    status: str = Field(default="pending", description="pending, processing, completed, rolled_back, failed")
    manual_override: bool = Field(default=False)
    override_params: Optional[Dict[str, Any]] = None

    @field_validator("flight_date", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            try:
                return parser.parse(v, dayfirst=False).date()
            except Exception:
                return parser.parse(v, dayfirst=True).date()
        raise ValueError(f"不支持的日期类型: {type(v)}")


class OptimizationResult(BaseModel):
    """优化结果。"""
    result_id: str
    request_id: str
    flight_no: str
    flight_date: date
    optimal_overbooking: Dict[CabinClass, int] = Field(description="各舱位最优超售数")
    expected_no_show_rate: Dict[CabinClass, float] = Field(description="各舱位预期爽约率")
    expected_revenue: float = Field(description="期望收入")
    expected_compensation_cost: float = Field(description="期望补偿成本")
    expected_net_profit: float = Field(description="期望净利润")
    risk_level: str = Field(description="风险等级: low, medium, high")
    risk_explanation: str = Field(description="风险人话解释")
    scenarios: List[Dict[str, Any]] = Field(description="多情景对比结果")
    anomalies: List[Dict[str, Any]] = Field(default_factory=list, description="检测到的异常记录")
    warnings: List[str] = Field(default_factory=list, description="警告信息")
    created_at: datetime = Field(default_factory=datetime.now)


class DataIssue(BaseModel):
    """数据问题记录。"""
    issue_id: str
    issue_type: str = Field(description="问题类型: duplicate, missing_field, date_format, name_conflict, late_arrival, cabin_mismatch, no_show_misestimation, compensation_missing")
    severity: str = Field(description="严重程度: info, warning, error, critical")
    description: str
    affected_records: List[Dict[str, Any]]
    suggested_action: str = Field(description="建议操作: accept, reject, manual_review, request_more_data")
    resolved: bool = Field(default=False)
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
