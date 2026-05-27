from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PackageRow(BaseModel):
    tracking_no: str = Field(..., description="快递单号")
    recipient_phone: str = Field(..., description="收件人手机号")
    recipient_name: Optional[str] = Field(None, description="收件人姓名")
    inbound_at: datetime = Field(..., description="入库时间")
    status: str = Field("in_storage", description="包裹状态")
    station_id: Optional[str] = Field(None, description="驿站编号")
    raw: Dict[str, Any] = Field(default_factory=dict, description="原始行字段")

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class SmsRecord(BaseModel):
    tracking_no: str
    phone: str
    sent_at: datetime
    template: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None


class ReturnRule(BaseModel):
    rule_id: str
    rule_name: str
    rule_type: str = "overdue_return"
    overstay_days: int = 7
    enabled: bool = True
    params: Dict[str, Any] = Field(default_factory=dict)


class Suggestion(BaseModel):
    code: str
    text: str


class FailedItem(BaseModel):
    tracking_no: str
    reason_codes: List[str]
    original: Dict[str, Any]
    suggestions: List[Suggestion]


class PendingItem(BaseModel):
    tracking_no: str
    reason_codes: List[str]
    original: Dict[str, Any]
    suggestions: List[Suggestion]


class NormalItem(BaseModel):
    tracking_no: str
    status: str
    summary: str


class AnalysisReport(BaseModel):
    batch_id: str
    generated_at: datetime
    normal_count: int
    pending_count: int
    failed_count: int
    normal: List[NormalItem]
    pending: List[PendingItem]
    failed: List[FailedItem]


class BatchIngestRequest(BaseModel):
    batch_id: str
    packages: List[PackageRow]
    sms_records: List[SmsRecord] = Field(default_factory=list)
    rules: List[ReturnRule] = Field(default_factory=list)


class BatchMeta(BaseModel):
    batch_id: str
    created_at: datetime
    package_count: int
    sms_count: int
    rule_count: int
    report_ref: Optional[str] = None


class ItemTrace(BaseModel):
    tracking_no: str
    batch_id: str
    original: Dict[str, Any]
    classification: str
    reason_codes: List[str]
    suggestions: List[Suggestion]
    report_ref: str
