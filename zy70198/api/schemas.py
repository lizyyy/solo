from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from models import PaymentPlanStatus, PaymentPriority, InvoiceStatus


class RuleTrace(BaseModel):
    rule: str = Field(..., description='规则编号')
    description: str = Field(..., description='规则描述')
    input: Dict[str, Any] = Field(..., description='规则输入参数')
    output: Any = Field(..., description='规则输出结果')
    passed: bool = Field(..., description='规则是否通过')
    is_warning: Optional[bool] = Field(default=False, description='是否为警告级别')


class BusinessResponse(BaseModel):
    success: bool = Field(..., description='业务操作是否成功')
    code: str = Field(..., description='业务结果码')
    message: str = Field(..., description='业务化的结果描述，非开发人员可理解')
    data: Optional[Dict[str, Any]] = Field(default=None, description='业务数据')
    needs_manual_review: bool = Field(default=False, description='是否需要人工复核')
    review_reason: Optional[str] = Field(default=None, description='需要人工复核的原因')
    next_action: Optional[str] = Field(default=None, description='下一步操作建议')
    rule_traces: List[RuleTrace] = Field(default_factory=list, description='规则执行轨迹，可用于复查')
    timestamp: datetime = Field(default_factory=datetime.now, description='处理时间')


class CreatePaymentPlanRequest(BaseModel):
    purchase_order_id: str = Field(..., description='采购订单号')
    vendor_id: str = Field(..., description='供应商ID')
    vendor_name: str = Field(..., description='供应商名称')
    contract_payment_terms: str = Field(..., description='合同付款条款原文')
    credit_period_days: int = Field(..., ge=0, description='账期天数')
    total_amount: float = Field(..., gt=0, description='计划付款总金额')
    priority: PaymentPriority = Field(default=PaymentPriority.NORMAL, description='付款优先级')
    expected_payment_date: Optional[date] = Field(default=None, description='期望付款日期，不填则按账期自动计算')
    created_by: str = Field(..., description='创建人')
    remark: Optional[str] = Field(default=None, description='备注')


class SubmitForSchedulingRequest(BaseModel):
    plan_id: str = Field(..., description='付款计划ID')
    submitted_by: str = Field(..., description='提交人')


class InsertionRequest(BaseModel):
    plan_id: str = Field(..., description='要插队的付款计划ID')
    target_position: int = Field(..., gt=0, description='目标插入位置，从1开始')
    justification: str = Field(..., description='插单理由')
    requested_by: str = Field(..., description='申请人')


class InsertionApprovalRequest(BaseModel):
    approval_id: str = Field(..., description='审批记录ID')
    approver: str = Field(..., description='审批人')
    comment: Optional[str] = Field(default=None, description='审批意见')
    rejection_reason: Optional[str] = Field(default=None, description='驳回理由（驳回时必填）')


class CreateInvoiceRequest(BaseModel):
    invoice_no: str = Field(..., description='发票号码')
    invoice_code: Optional[str] = Field(default=None, description='发票代码')
    vendor_id: str = Field(..., description='供应商ID')
    purchase_order_id: str = Field(..., description='关联采购订单号')
    invoice_date: date = Field(..., description='发票开票日期')
    invoice_amount: float = Field(..., gt=0, description='发票金额')
    tax_amount: Optional[float] = Field(default=None, description='税额')


class MatchInvoiceRequest(BaseModel):
    invoice_id: str = Field(..., description='发票ID')
    payment_plan_id: str = Field(..., description='付款计划ID')
    operator: str = Field(..., description='操作人')


class CreateFundCalendarRequest(BaseModel):
    name: str = Field(..., description='日历名称')
    fiscal_year: int = Field(..., description='财年')
    created_by: str = Field(..., description='创建人')


class AddFundEntryRequest(BaseModel):
    calendar_id: str = Field(..., description='资金日历ID')
    entry_date: date = Field(..., description='资金日期')
    total_fund: float = Field(..., ge=0, description='当日可用资金总额')
    operator: str = Field(..., description='操作人')
    remark: Optional[str] = Field(default=None, description='备注')


class RunSchedulingRequest(BaseModel):
    target_month: str = Field(..., description='目标排程月份，格式YYYY-MM')
    triggered_by: str = Field(..., description='触发人')
    is_auto_run: bool = Field(default=False, description='是否自动排程')


class PaymentPlanSummary(BaseModel):
    plan_id: str
    purchase_order_id: str
    vendor_name: str
    total_amount: float
    priority: PaymentPriority
    status: PaymentPlanStatus
    current_payment_date: Optional[date]
    expected_payment_date: Optional[date]
    is_insertion: bool


class ScheduleReportRequest(BaseModel):
    start_date: date = Field(..., description='报表起始日期')
    end_date: date = Field(..., description='报表结束日期')
    include_rule_traces: bool = Field(default=False, description='是否包含规则轨迹')
