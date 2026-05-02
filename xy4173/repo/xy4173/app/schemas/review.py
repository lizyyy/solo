from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ReviewBase(BaseModel):
    review_code: str = Field(..., min_length=1, max_length=50)
    violation_id: Optional[int] = None
    bill_id: Optional[int] = None
    reservation_id: Optional[int] = None
    reviewer_id: str = Field(..., min_length=1, max_length=50)
    reviewer_name: Optional[str] = None
    review_type: str = Field(..., min_length=1, max_length=50)
    review_action: str = Field(..., min_length=1, max_length=50)
    comments: Optional[str] = None
    is_approved: bool = False
    reviewed_at: datetime = Field(default_factory=datetime.now)
    previous_status: Optional[str] = None
    new_status: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(BaseModel):
    comments: Optional[str] = None
    is_approved: Optional[bool] = None
    review_action: Optional[str] = None


class ReviewResponse(ReviewBase):
    id: int
    import_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
