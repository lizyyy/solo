"""数据模型"""

from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict


class LateCause(Enum):
    """迟到原因"""
    SHUTTLE_LATE = "班车晚点"
    PERSONAL = "个人原因"
    UNKNOWN = "待确认"
    CLAIM_REVIEW = "申诉审核中"
    CLAIM_APPROVED = "申诉通过"
    CLAIM_REJECTED = "申诉驳回"


class SubsidizeStatus(Enum):
    """补贴状态"""
    ELIGIBLE = "可补贴"
    NOT_ELIGIBLE = "不可补贴"
    PENDING_CLAIM = "待申诉"
    CLAIM_APPROVED = "申诉通过"
    CLAIM_REJECTED = "申诉驳回"
    CONFIRMED = "已确认"


class ExceptionType(Enum):
    """异常类型"""
    NO_CHECK_IN = "打卡缺失"
    NO_GPS_RECORD = "未乘车"
    ROUTE_CANCELLED = "线路取消"
    DUPLICATE_IMPORT = "重复导入"


@dataclass
class Schedule:
    """线路时刻表"""
    route_id: str
    route_name: str
    stop_id: str
    stop_name: str
    scheduled_time: datetime
    is_weekend: bool = False


@dataclass
class GPSRecord:
    """车辆到站记录"""
    route_id: str
    stop_id: str
    vehicle_id: str
    record_date: date
    actual_time: Optional[datetime]
    is_cancelled: bool = False
    import_batch: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class EmployeeRoute:
    """员工乘车名单"""
    employee_id: str
    employee_name: str
    department: str
    route_id: str
    stop_id: str
    stop_name: str
    effective_date: date
    end_date: Optional[date] = None


@dataclass
class CheckInRecord:
    """打卡记录"""
    employee_id: str
    check_date: date
    check_time: Optional[datetime]
    is_leave: bool = False
    leave_type: str = ""


@dataclass
class Claim:
    """申诉记录"""
    claim_id: str
    employee_id: str
    employee_name: str
    check_date: date
    original_cause: LateCause
    original_status: SubsidizeStatus
    claim_reason: str
    status: str = "pending"
    review_comment: str = ""
    reviewed_at: Optional[datetime] = None


@dataclass
class CalculationResult:
    """计算结果"""
    employee_id: str
    employee_name: str
    department: str
    check_date: date
    scheduled_time: Optional[datetime]
    actual_arrival_time: Optional[datetime]
    check_time: Optional[datetime]
    work_start_time: datetime
    is_late: bool
    late_minutes: int
    cause: LateCause
    subsidize_status: SubsidizeStatus
    subsidize_amount: float
    exception_type: Optional[ExceptionType]
    route_name: str
    stop_name: str
    remark: str = ""
    claim_id: Optional[str] = None


@dataclass
class MonthlyReport:
    """月度报表"""
    report_month: str
    total_employees: int
    total_late_count: int
    shuttle_late_count: int
    personal_late_count: int
    exception_count: int
    total_subsidize: float
    results: List[CalculationResult] = field(default_factory=list)
    exceptions: List[CalculationResult] = field(default_factory=list)
