from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.models import RiskLevel, VerdictStatus, ChangeCategory


class ContractChangeCreate(BaseModel):
    api_path: str = Field(..., description="接口路径")
    http_method: str = Field(..., description="HTTP方法")
    old_contract: Dict[str, Any] = Field(..., description="旧契约")
    new_contract: Dict[str, Any] = Field(..., description="新契约")
    caller: str = Field(..., description="调用方")


class ContractChangeResponse(BaseModel):
    id: int
    api_path: str
    http_method: str
    caller: str
    risk_level: RiskLevel
    verdict_opinion: Optional[str]
    status: VerdictStatus
    change_category: ChangeCategory
    diff_summary: Optional[Dict[str, Any]]
    raw_input: Optional[Dict[str, Any]]
    processing_basis: Optional[str]
    final_conclusion: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    confirmed_at: Optional[datetime]
    completed_at: Optional[datetime]
    deferral_reason: Optional[str]
    deferral_expiry: Optional[datetime]
    manual_override: Optional[Dict[str, Any]]

    class Config:
        orm_mode = True


class ContractChangeQuery(BaseModel):
    api_path: Optional[str] = None
    http_method: Optional[str] = None
    caller: Optional[str] = None
    risk_level: Optional[RiskLevel] = None
    status: Optional[VerdictStatus] = None
    change_category: Optional[ChangeCategory] = None
    page: int = 1
    page_size: int = 20


class StatusUpdateRequest(BaseModel):
    new_status: VerdictStatus
    reason: Optional[str] = None
    updated_by: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    risk_level: Optional[RiskLevel] = None
    verdict_opinion: Optional[str] = None
    change_category: Optional[ChangeCategory] = None
    corrected_by: str
    reason: str


class DeferralRequest(BaseModel):
    reason: str
    expiry_days: int = Field(..., ge=1, le=30)
    requested_by: str


class VerdictReportResponse(BaseModel):
    id: int
    contract_change_id: int
    report_type: str
    content: Dict[str, Any]
    generated_at: datetime
    generated_by: Optional[str]

    class Config:
        orm_mode = True


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ContractChangeResponse]
