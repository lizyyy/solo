from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ScheduleStatus(str, Enum):
    PROPOSED = 'proposed'
    CONFIRMED = 'confirmed'
    ADJUSTED = 'adjusted'
    DELAYED = 'delayed'
    EXECUTED = 'executed'
    CANCELLED = 'cancelled'


class ScheduleRecord(BaseModel):
    id: str = Field(..., description='排程记录ID')
    payment_plan_id: str = Field(..., description='关联的付款计划ID')
    
    original_payment_date: date = Field(..., description='原排定付款日期')
    new_payment_date: Optional[date] = Field(default=None, description='调整后的付款日期')
    
    schedule_amount: float = Field(..., gt=0, description='本次排程金额')
    
    reason: str = Field(..., description='排程/调整原因')
    adjustment_type: Optional[str] = Field(default=None, description='调整类型：insertion/delay/fund_shortage/manual')
    
    fund_calendar_entry_id: Optional[str] = Field(default=None, description='关联的资金日历条目ID')
    
    status: ScheduleStatus = Field(default=ScheduleStatus.PROPOSED, description='排程记录状态')
    
    created_by: str = Field(..., description='创建人')
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    
    remark: Optional[str] = Field(default=None, description='备注')


class PaymentSchedule(BaseModel):
    id: str = Field(..., description='排程批次ID')
    batch_no: str = Field(..., description='排程批次号')
    
    schedule_date: date = Field(..., description='排程计算日期')
    target_month: str = Field(..., description='目标排程月份，格式YYYY-MM')
    
    total_planned_amount: float = Field(default=0, description='本批次计划付款总额')
    affected_plan_count: int = Field(default=0, description='受影响的付款计划数量')
    
    is_auto_run: bool = Field(default=False, description='是否自动排程触发')
    trigger_source: str = Field(..., description='触发来源：manual/batch/insertion')
    
    created_by: str = Field(..., description='创建人')
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
