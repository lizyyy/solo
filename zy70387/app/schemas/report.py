from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime


class RuleHitDetail(BaseModel):
    rule_id: int
    rule_name: str
    rule_version: int
    sample_rate: float
    is_vip_tenant: bool
    task_type: Optional[str]
    tenant_id: Optional[str]
    hit_count: int
    explanation: str


class DailyReport(BaseModel):
    stat_date: date
    total_logs: int
    sampled_logs: int
    dropped_logs: int
    duplicate_logs: int
    failure_logs: int
    failure_context_logs: int
    retention_rate: float = Field(description="保留率 = sampled_logs / total_logs")
    failure_rate: float = Field(description="失败率 = failure_logs / total_logs")


class TenantReport(BaseModel):
    tenant_id: str
    total_logs: int
    sampled_logs: int
    dropped_logs: int
    failure_logs: int
    retention_rate: float
    rule_hits: List[RuleHitDetail] = []


class LogReport(BaseModel):
    generated_at: datetime
    
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    
    summary: dict = Field(description="汇总统计")
    daily_reports: List[DailyReport] = []
    tenant_reports: List[TenantReport] = []
    
    top_dropped_reasons: List[dict] = []
    rule_hit_details: List[RuleHitDetail] = []
    
    recent_failures: List[dict] = []
