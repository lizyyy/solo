from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BatchCreate(BaseModel):
    batch_code: str
    name: str
    agent_id: str
    record_count: int
    recording_ids: List[str]


class BatchResponse(BaseModel):
    id: int
    batch_code: str
    name: str
    agent_id: str
    record_count: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class RuleCreate(BaseModel):
    name: str
    sampling_ratio: float = Field(gt=0, le=1)
    min_samples: int = 1
    max_samples: int = 100
    description: Optional[str] = None


class RuleResponse(BaseModel):
    id: int
    name: str
    sampling_ratio: float
    min_samples: int
    max_samples: int
    description: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True


class SamplingRequest(BaseModel):
    batch_id: int
    rule_id: int
    inspectors: List[str]


class AssignmentResponse(BaseModel):
    id: int
    inspector_id: str
    status: str
    assigned_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class InspectionRequest(BaseModel):
    assignment_id: int
    score: float = Field(ge=0, le=100)
    is_passed: bool
    comments: Optional[str] = None
    inspector_id: str


class InspectionResponse(BaseModel):
    id: int
    score: float
    is_passed: bool
    comments: Optional[str]
    inspected_at: datetime
    
    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    inspection_result_id: int
    appeal_reason: str
    appeal_by: str


class ReviewResponse(BaseModel):
    id: int
    inspection_result_id: int
    appeal_reason: str
    appeal_by: str
    appeal_at: datetime
    status: str
    
    class Config:
        from_attributes = True


class ReviewProcess(BaseModel):
    review_id: int
    review_comments: str
    review_by: str
    score_adjusted: bool = False
    adjusted_score: Optional[float] = None


class ScoreFreezeCreate(BaseModel):
    inspection_result_id: int
    reason: str
    frozen_score: float
    operator_id: str


class ScoreFreezeResponse(BaseModel):
    id: int
    reason: str
    frozen_score: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class HistoryResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator_id: str
    timestamp: datetime
    comments: Optional[str]
    
    class Config:
        from_attributes = True


class QualityReport(BaseModel):
    batch_id: int
    batch_code: str
    total_assigned: int
    completed: int
    passed: int
    failed: int
    avg_score: float
    under_review: int
    score_frozen: int
