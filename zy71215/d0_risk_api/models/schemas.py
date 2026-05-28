from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class FreezeReason(str, Enum):
    RISK_ALERT = "risk_alert"
    REFUND_SURGE = "refund_surge"
    COMPLIANCE = "compliance"
    MANUAL = "manual"


class FreezeStatus(str, Enum):
    ACTIVE = "active"
    LIFTED = "lifted"


class AdvanceStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TransactionFlow(BaseModel):
    merchant_id: str
    trade_date: date
    tx_count: int = Field(ge=0)
    tx_amount: float = Field(ge=0)
    refund_count: int = Field(ge=0, default=0)
    refund_amount: float = Field(ge=0, default=0)
    version: int = Field(ge=1, default=1)
    ingested_at: datetime = Field(default_factory=datetime.now)


class AdvanceApplication(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merchant_id: str
    apply_amount: float = Field(gt=0)
    apply_date: date
    fee_version: Optional[str] = None
    status: AdvanceStatus = AdvanceStatus.PENDING
    risk_check_passed: Optional[bool] = None
    reject_reasons: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class RefundRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merchant_id: str
    original_tx_date: date
    refund_amount: float = Field(gt=0)
    refund_date: date
    version: int = Field(ge=1, default=1)
    ingested_at: datetime = Field(default_factory=datetime.now)


class FreezeRecord(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merchant_id: str
    reason: FreezeReason
    status: FreezeStatus = FreezeStatus.ACTIVE
    frozen_amount: float = Field(ge=0, default=0)
    effective_from: datetime = Field(default_factory=datetime.now)
    lifted_at: Optional[datetime] = None
    version: int = Field(ge=1, default=1)


class FeeRule(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merchant_id: str
    fee_version: str
    d0_fee_rate: float = Field(ge=0, le=1)
    advance_ratio: float = Field(ge=0, le=1, description="垫资比例上限, 如0.8表示最高垫资80%")
    effective_from: date
    effective_to: Optional[date] = None
    version: int = Field(ge=1, default=1)


class RiskReportItem(BaseModel):
    rule_code: str
    rule_name: str
    level: RiskLevel
    detail: str
    suggestion: Optional[str] = None


class RiskReport(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    merchant_id: str
    report_date: date
    items: list[RiskReportItem] = Field(default_factory=list)
    overall_level: RiskLevel = RiskLevel.LOW
    created_at: datetime = Field(default_factory=datetime.now)


class AdvanceCheckRequest(BaseModel):
    merchant_id: str
    apply_amount: float = Field(gt=0)
    apply_date: date
    fee_version: Optional[str] = None


class AdvanceCheckResponse(BaseModel):
    application_id: str
    merchant_id: str
    passed: bool
    approved_amount: float
    fee_version_used: Optional[str] = None
    risk_level: RiskLevel
    reject_reasons: list[str] = Field(default_factory=list)
    report_items: list[RiskReportItem] = Field(default_factory=list)


class RefundRollbackRequest(BaseModel):
    merchant_id: str
    refund_id: str


class RefundRollbackResponse(BaseModel):
    refund_id: str
    merchant_id: str
    rolled_back: bool
    affected_advances: list[str] = Field(default_factory=list)
    reason: Optional[str] = None


class ReportExportResponse(BaseModel):
    merchant_id: str
    report_date: date
    summary: str
    detail: dict
