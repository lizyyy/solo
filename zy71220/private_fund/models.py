"""
核心数据模型
"""
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import uuid4


class CoolOffStatus(str, Enum):
    """冷静期状态"""
    PENDING = "待计算"
    LOCKED = "已锁住"
    RUNNING = "冷静期中"
    EXPIRED = "冷静期未满"
    COMPLETED = "冷静期完成"
    FAILED = "校验失败"


class MaterialStatus(str, Enum):
    """材料状态"""
    VALID = "有效"
    EXPIRED = "已过期"
    INCOMPLETE = "不完整"
    NOT_FOUND = "未上传"


class VisitStatus(str, Enum):
    """回访状态"""
    NOT_STARTED = "未回访"
    RECORDED = "已录音"
    CONFIRMED = "已确认"
    REJECTED = "客户拒绝"


class SubscriptionStatus(str, Enum):
    """认购单状态"""
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    LOCKED = "已锁住"
    VERIFYING = "校验中"
    VERIFIED = "校验通过"
    REJECTED = "校验不通过"
    REPORTED = "已出报告"


class MaterialType(str, Enum):
    """材料类型"""
    ID_CARD = "身份证"
    ASSET_PROOF = "资产证明"
    INVESTOR_QUALIFICATION = "合格投资者认定"
    RISK_ASSESSMENT = "风险测评"
    SIGNATURE = "签署文件"


@dataclass
class InvestorMaterial:
    """投资者材料"""
    material_id: str = field(default_factory=lambda: uuid4().hex[:12])
    investor_id: str = ""
    material_type: MaterialType = MaterialType.ID_CARD
    file_path: str = ""
    upload_date: date = field(default_factory=date.today)
    expire_date: Optional[date] = None
    is_valid: bool = True
    status: MaterialStatus = MaterialStatus.VALID

    def check_valid(self, check_date: Optional[date] = None) -> MaterialStatus:
        """检查材料有效性"""
        check_date = check_date or date.today()
        if self.expire_date and self.expire_date < check_date:
            self.status = MaterialStatus.EXPIRED
            self.is_valid = False
        elif not self.file_path:
            self.status = MaterialStatus.NOT_FOUND
            self.is_valid = False
        return self.status


@dataclass
class CoolOffPeriod:
    """冷静期"""
    cool_off_id: str = field(default_factory=lambda: uuid4().hex[:12])
    subscription_id: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_hours: int = 24
    status: CoolOffStatus = CoolOffStatus.PENDING
    is_locked: bool = False
    lock_reason: str = ""

    def lock(self, reason: str = "") -> None:
        """锁住冷静期"""
        self.is_locked = True
        self.lock_reason = reason or "材料、冷静期、回访已关联锁住"
        self.status = CoolOffStatus.LOCKED

    def start(self, start_time: Optional[datetime] = None) -> None:
        """开始冷静期"""
        self.start_time = start_time or datetime.now()
        if self.duration_hours:
            from datetime import timedelta
            self.end_time = self.start_time + timedelta(hours=self.duration_hours)
        self.status = CoolOffStatus.RUNNING

    def check_status(self, check_time: Optional[datetime] = None) -> CoolOffStatus:
        """检查冷静期状态"""
        if not self.start_time:
            return CoolOffStatus.PENDING
        check_time = check_time or datetime.now()
        if self.end_time and check_time < self.end_time:
            self.status = CoolOffStatus.EXPIRED
        elif self.end_time and check_time >= self.end_time:
            self.status = CoolOffStatus.COMPLETED
        return self.status

    def remaining_hours(self, check_time: Optional[datetime] = None) -> float:
        """计算剩余小时数"""
        if not self.start_time or not self.end_time:
            return 0.0
        check_time = check_time or datetime.now()
        remaining = (self.end_time - check_time).total_seconds() / 3600
        return max(0.0, remaining)


@dataclass
class VisitRecord:
    """回访记录"""
    visit_id: str = field(default_factory=lambda: uuid4().hex[:12])
    subscription_id: str = ""
    investor_id: str = ""
    record_file_path: str = ""
    visit_time: Optional[datetime] = None
    operator: str = ""
    confirm_result: bool = False
    confirm_time: Optional[datetime] = None
    status: VisitStatus = VisitStatus.NOT_STARTED
    notes: str = ""

    def record(self, record_file: str, operator: str, visit_time: Optional[datetime] = None) -> None:
        """录入回访录音"""
        self.record_file_path = record_file
        self.operator = operator
        self.visit_time = visit_time or datetime.now()
        self.status = VisitStatus.RECORDED

    def confirm(self, confirm_result: bool, confirm_time: Optional[datetime] = None) -> None:
        """确认回访结果"""
        self.confirm_result = confirm_result
        self.confirm_time = confirm_time or datetime.now()
        self.status = VisitStatus.CONFIRMED if confirm_result else VisitStatus.REJECTED


@dataclass
class PaymentFlow:
    """打款流水"""
    flow_id: str = field(default_factory=lambda: uuid4().hex[:12])
    subscription_id: str = ""
    amount: float = 0.0
    pay_time: Optional[datetime] = None
    pay_account: str = ""
    receive_account: str = ""
    is_matched: bool = False


@dataclass
class ConfirmReport:
    """确认报告"""
    report_id: str = field(default_factory=lambda: uuid4().hex[:12])
    subscription_id: str = ""
    generate_time: Optional[datetime] = None
    operator: str = ""
    file_path: str = ""
    is_exported: bool = False
    include_items: List[str] = field(default_factory=list)


@dataclass
class SubscriptionOrder:
    """认购单 - 核心聚合根"""
    subscription_id: str = field(default_factory=lambda: uuid4().hex[:12])
    order_no: str = ""
    investor_id: str = ""
    investor_name: str = ""
    product_code: str = ""
    product_name: str = ""
    subscription_amount: float = 0.0
    submit_time: Optional[datetime] = None
    status: SubscriptionStatus = SubscriptionStatus.DRAFT
    operator: str = ""

    materials: List[InvestorMaterial] = field(default_factory=list)
    cool_off: Optional[CoolOffPeriod] = None
    visit: Optional[VisitRecord] = None
    payment: Optional[PaymentFlow] = None
    report: Optional[ConfirmReport] = None

    error_details: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def lock_all(self) -> bool:
        """
        锁住逻辑：冷静期、回访确认、合格投资者材料必须一起锁住
        三者缺一不可，任何一个缺失都不能锁住
        """
        errors = []

        if not self.materials:
            errors.append("缺少合格投资者材料")
        else:
            for m in self.materials:
                m.check_valid()
                if m.status != MaterialStatus.VALID:
                    errors.append(f"材料[{m.material_type.value}]状态: {m.status.value}")

        if not self.cool_off:
            errors.append("缺少冷静期记录")
        elif not self.cool_off.is_locked:
            self.cool_off.lock()

        if not self.visit:
            errors.append("缺少回访记录")
        elif self.visit.status not in [VisitStatus.CONFIRMED, VisitStatus.RECORDED]:
            errors.append(f"回访状态: {self.visit.status.value}，需为已录音或已确认")

        if errors:
            self.error_details = errors
            self.status = SubscriptionStatus.REJECTED
            return False

        self.status = SubscriptionStatus.LOCKED
        return True

    def get_related_ids(self) -> Dict[str, Any]:
        """获取所有关联线索ID，用于串联查询"""
        return {
            "subscription_id": self.subscription_id,
            "order_no": self.order_no,
            "investor_id": self.investor_id,
            "material_ids": [m.material_id for m in self.materials],
            "cool_off_id": self.cool_off.cool_off_id if self.cool_off else None,
            "visit_id": self.visit.visit_id if self.visit else None,
            "flow_id": self.payment.flow_id if self.payment else None,
            "report_id": self.report.report_id if self.report else None,
        }
