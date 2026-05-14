from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class AdPlanBase(BaseModel):
    plan_name: str
    channel: str
    budget: float
    original_input: str

class AdPlanCreate(AdPlanBase):
    pass

class AdPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    channel: Optional[str] = None
    budget: Optional[float] = None
    review_status: Optional[str] = None
    spend_status: Optional[str] = None
    actual_spend: Optional[float] = None
    processed_result: Optional[str] = None
    is_paused: Optional[bool] = None

class AdPlan(AdPlanBase):
    id: int
    version: int
    processed_result: Optional[str] = None
    review_status: str
    spend_status: str
    actual_spend: float
    is_paused: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StatusLogBase(BaseModel):
    ad_plan_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    change_reason: Optional[str] = None
    operator: Optional[str] = None

class StatusLogCreate(StatusLogBase):
    pass

class StatusLog(StatusLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PauseRuleBase(BaseModel):
    ad_plan_id: int
    rule_type: str
    rule_value: Optional[str] = None
    reason: str
    operator: Optional[str] = None

class PauseRuleCreate(PauseRuleBase):
    pass

class PauseRule(PauseRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class DeliveryReportBase(BaseModel):
    ad_plan_id: int
    report_date: str
    impressions: int = 0
    clicks: int = 0
    spend: float = 0

class DeliveryReportCreate(DeliveryReportBase):
    pass

class DeliveryReport(DeliveryReportBase):
    id: int
    ctr: float
    cpc: float
    created_at: datetime

    class Config:
        from_attributes = True

class AdPlanDetail(AdPlan):
    status_logs: List[StatusLog] = []
    pause_rules: List[PauseRule] = []
    reports: List[DeliveryReport] = []

    class Config:
        from_attributes = True
