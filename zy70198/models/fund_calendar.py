from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class FundStatus(str, Enum):
    AVAILABLE = 'available'
    PARTIALLY_USED = 'partially_used'
    FULLY_USED = 'fully_used'
    LOCKED = 'locked'
    CANCELLED = 'cancelled'


class FundCalendarEntry(BaseModel):
    id: str = Field(..., description='资金日历条目ID')
    calendar_date: date = Field(..., description='资金日期')
    
    total_fund: float = Field(..., ge=0, description='当日可用资金总额')
    reserved_fund: float = Field(default=0, description='已预留给付款计划的金额')
    
    status: FundStatus = Field(default=FundStatus.AVAILABLE, description='资金状态')
    
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
    
    @property
    def available_fund(self) -> float:
        return self.total_fund - self.reserved_fund
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()


class FundCalendar(BaseModel):
    id: str = Field(..., description='资金日历ID')
    name: str = Field(..., description='日历名称')
    fiscal_year: int = Field(..., description='财年')
    
    is_active: bool = Field(default=True, description='是否启用')
    
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()
