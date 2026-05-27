from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class BatchUploadResponse(BaseModel):
    batch_id: str
    message: str
    summary: Dict[str, int]
    duplicates_skipped: int


class QualityRecordItem(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    record_type: str
    error_type: Optional[str]
    agent_id: Optional[str]
    agent_name: Optional[str]
    call_id: Optional[str]
    score_original: Optional[float]
    score_after_appeal: Optional[float]
    score_final: Optional[float]
    deduction_reason: Optional[str]
    appeal_reason: Optional[str]
    review_status: str
    is_deduction_revoked: bool
    needs_second_review: bool
    suggestion: Optional[str]
    error_message: Optional[str]
    raw_data: Optional[str]
    data_source: Optional[str]
    created_at: datetime


class BatchResultResponse(BaseModel):
    batch_id: str
    submitted_at: datetime
    is_processed: bool
    normal: List[QualityRecordItem]
    pending: List[QualityRecordItem]
    failed: List[QualityRecordItem]
    summary: Dict[str, int]


class ReviewActionRequest(BaseModel):
    record_id: int
    action: str = Field(description="accept_revoke / reject_revoke / second_review_done / finalize")
    operator: str
    note: Optional[str] = None


class ReviewActionResponse(BaseModel):
    success: bool
    record_id: int
    new_status: str
    message: str


class BatchListResponse(BaseModel):
    batch_id: str
    submitted_at: datetime
    is_processed: bool
    total_records: int
    normal_count: int
    pending_count: int
    failed_count: int


class RuleExplanation(BaseModel):
    rule_code: str
    rule_name: str
    description: str
    applicable_scenarios: List[str]
    example: str


class SystemInfo(BaseModel):
    version: str
    supported_file_types: List[str]
    active_rules: List[RuleExplanation]
