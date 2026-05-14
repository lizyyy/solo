from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class SliceRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    min_length: int = 50
    max_length: int = 500
    overlap: int = 50
    separator: str = "\n\n"
    is_active: bool = True

class SliceRuleCreate(SliceRuleBase):
    pass

class SliceRule(SliceRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class QualityRecordBase(BaseModel):
    document_id: Optional[str] = None
    document_name: str
    original_content: str
    sliced_content: Optional[str] = None
    slice_rule_id: Optional[int] = None
    recall_score: Optional[float] = None
    has_answer: Optional[bool] = None
    status: str = "pending"
    error_message: Optional[str] = None

class QualityRecordCreate(QualityRecordBase):
    pass

class QualityRecord(QualityRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ApprovalRecordBase(BaseModel):
    quality_record_id: int
    action: str
    comment: Optional[str] = None
    operator: str

class ApprovalRecordCreate(ApprovalRecordBase):
    pass

class ApprovalRecord(ApprovalRecordBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class QualityRecordWithApprovals(QualityRecord):
    approvals: List[ApprovalRecord] = []

class Statistics(BaseModel):
    total: int
    success: int
    blocked: int
    compensated: int
    pending_review: int
    success_rate: float
