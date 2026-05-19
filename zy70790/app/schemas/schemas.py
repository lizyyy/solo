from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEEDS_REVIEW = "needs_review"
    ALREADY_PROCESSED = "already_processed"


class LanguageBase(BaseModel):
    name: str
    display_name: Optional[str] = None


class LanguageCreate(LanguageBase):
    pass


class Language(LanguageBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SdkConfigBase(BaseModel):
    language_id: int
    sdk_version: Optional[str] = None
    config_source: Optional[str] = None
    config_content: str


class SdkConfigCreate(SdkConfigBase):
    pass


class SdkConfig(SdkConfigBase):
    id: int
    imported_at: datetime
    is_active: bool
    language: Language

    class Config:
        from_attributes = True


class RetryPolicyBase(BaseModel):
    status_code: int
    max_retries: int
    backoff_strategy: str
    initial_delay: Optional[float] = None
    max_delay: Optional[float] = None
    multiplier: Optional[float] = None
    jitter_enabled: bool = False
    is_retryable: bool = True


class RetryPolicyCreate(RetryPolicyBase):
    sdk_config_id: int


class RetryPolicy(RetryPolicyBase):
    id: int
    sdk_config_id: int
    status_code_category: Optional[str] = None

    class Config:
        from_attributes = True


class BackoffDiscrepancyBase(BaseModel):
    status_code: int
    language_a: str
    language_b: str
    field_name: str
    value_a: Optional[str] = None
    value_b: Optional[str] = None
    severity: str
    description: Optional[str] = None


class BackoffDiscrepancy(BackoffDiscrepancyBase):
    id: int
    report_id: int
    resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PolicyReportBase(BaseModel):
    report_name: str
    comparison_type: Optional[str] = None


class PolicyReportCreate(PolicyReportBase):
    pass


class PolicyReport(PolicyReportBase):
    id: int
    status_codes_analyzed: int
    discrepancies_found: int
    report_content: Optional[str] = None
    generated_at: datetime
    needs_review: bool
    reviewed: bool
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    discrepancies: List[BackoffDiscrepancy] = []

    class Config:
        from_attributes = True


class ConfigImportRequest(BaseModel):
    language: str
    sdk_version: Optional[str] = None
    config_source: Optional[str] = None
    config_data: Dict[str, Any]


class ConfigImportResponse(BaseModel):
    success: bool
    sdk_config_id: int
    message: str
    policies_parsed: int


class ComparisonRequest(BaseModel):
    languages: List[str]
    status_codes: Optional[List[int]] = None


class ComparisonResponse(BaseModel):
    report_id: int
    report_name: str
    status_codes_analyzed: int
    discrepancies_found: int
    discrepancies: List[BackoffDiscrepancy]


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None


class PolicyFilter(BaseModel):
    language: Optional[str] = None
    status_code: Optional[int] = None
    status_code_category: Optional[str] = None
    is_retryable: Optional[bool] = None