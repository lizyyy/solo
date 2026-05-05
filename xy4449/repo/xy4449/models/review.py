from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CLARIFICATION = "needs_clarification"


class ReviewRecord(BaseModel):
    id: str
    work_order_id: str
    preflight_result_id: str
    
    status: ReviewStatus = ReviewStatus.PENDING
    
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    notes: Optional[str] = None
    actions_required: List[str] = Field(default_factory=list)
    
    risk_assessment: Optional[str] = None
    mitigation_notes: Optional[str] = None
    
    next_reviewer: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def approve(self, reviewer: str, notes: str = ""):
        self.status = ReviewStatus.APPROVED
        self.reviewer = reviewer
        self.reviewed_at = datetime.now()
        self.notes = notes
        self.updated_at = datetime.now()
    
    def reject(self, reviewer: str, notes: str, actions: List[str] = None):
        self.status = ReviewStatus.REJECTED
        self.reviewer = reviewer
        self.reviewed_at = datetime.now()
        self.notes = notes
        if actions:
            self.actions_required = actions
        self.updated_at = datetime.now()
    
    def request_clarification(self, reviewer: str, notes: str, next_reviewer: str = None):
        self.status = ReviewStatus.NEEDS_CLARIFICATION
        self.reviewer = reviewer
        self.reviewed_at = datetime.now()
        self.notes = notes
        self.next_reviewer = next_reviewer
        self.updated_at = datetime.now()
    
    @property
    def is_pending(self) -> bool:
        return self.status == ReviewStatus.PENDING
    
    @property
    def is_approved(self) -> bool:
        return self.status == ReviewStatus.APPROVED
    
    @property
    def is_rejected(self) -> bool:
        return self.status == ReviewStatus.REJECTED
