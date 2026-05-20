from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ResultStatus(str, Enum):
    NORMAL = "normal"
    PENDING = "pending"
    FAILED = "failed"

class MaterialItem(BaseModel):
    material_type: str
    file_name: str
    amount: float = 0
    is_valid: bool = True

class PolicyInfo(BaseModel):
    policy_no: str
    policy_holder: str
    coverage_amount: float
    effective_date: datetime
    expiry_date: datetime
    product_name: str

class ClaimSubmissionCreate(BaseModel):
    batch_no: str
    policy_no: str
    claimant_name: str
    total_amount: float
    materials: List[MaterialItem]

class AuditRuleCreate(BaseModel):
    rule_code: str
    rule_name: str
    rule_type: str
    condition: str
    severity: str
    suggestion: str
    is_active: bool = True

class AuditResultResponse(BaseModel):
    id: int
    material_type: Optional[str]
    file_name: Optional[str]
    rule_code: str
    result_status: str
    suggestion: str
    source_rule: str
    audit_time: datetime
    original_fields: Optional[dict]

    class Config:
        from_attributes = True

class ClaimAuditResponse(BaseModel):
    batch_no: str
    policy_no: str
    normal_items: List[AuditResultResponse]
    pending_items: List[AuditResultResponse]
    failed_items: List[AuditResultResponse]

class HistoryTraceItem(BaseModel):
    audit_time: datetime
    result_status: str
    suggestion: str
    source_rule: str
    reviewer: Optional[str]
    review_comment: Optional[str]
    class Config:
        from_attributes = True
