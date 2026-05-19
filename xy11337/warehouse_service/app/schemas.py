from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class PickupBase(BaseModel):
    pickup_no: str = Field(..., max_length=50)
    work_order_no: str = Field(..., max_length=50)
    engineer: str = Field(..., max_length=100)
    part_code: str = Field(..., max_length=100)
    part_name: str = Field(..., max_length=200)
    quantity: int
    pickup_date: datetime
    remark: Optional[str] = None


class PickupCreate(PickupBase):
    pass


class Pickup(PickupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReturnBase(BaseModel):
    return_no: str = Field(..., max_length=50)
    pickup_no: str = Field(..., max_length=50)
    return_date: datetime
    return_quantity: int
    is_defective: bool = True
    defect_description: Optional[str] = None
    receiver: str = Field(..., max_length=100)


class ReturnCreate(ReturnBase):
    pass


class Return(ReturnBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClaimBase(BaseModel):
    claim_no: str = Field(..., max_length=50)
    pickup_no: str = Field(..., max_length=50)
    vendor: str = Field(..., max_length=200)
    claim_date: datetime
    claim_amount: float
    status: str = "pending"
    approver: Optional[str] = None
    remark: Optional[str] = None


class ClaimCreate(ClaimBase):
    pass


class Claim(ClaimBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnomalyBase(BaseModel):
    anomaly_no: str = Field(..., max_length=50)
    pickup_no: str = Field(..., max_length=50)
    anomaly_type: str = Field(..., max_length=100)
    description: str
    severity: str = "medium"
    status: str = "open"
    handler: Optional[str] = None


class AnomalyCreate(AnomalyBase):
    pass


class Anomaly(AnomalyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    review_no: str = Field(..., max_length=50)
    reviewer: str = Field(..., max_length=100)
    total_pickups: int = 0
    matched_count: int = 0
    unmatched_count: int = 0
    anomaly_count: int = 0
    remark: Optional[str] = None


class ReviewRecordCreate(ReviewRecordBase):
    pass


class ReviewRecord(ReviewRecordBase):
    id: int
    review_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class MatchResult(BaseModel):
    pickup_no: str
    work_order_no: str
    engineer: str
    part_code: str
    part_name: str
    pickup_quantity: int
    has_return: bool
    return_quantity: Optional[int] = None
    has_claim: bool
    claim_status: Optional[str] = None
    is_fully_matched: bool
    anomalies: List[str] = []


class ImportResult(BaseModel):
    success: int
    failed: int
    errors: List[str] = []


class FilterParams(BaseModel):
    engineer: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    anomaly_type: Optional[str] = None
    handler: Optional[str] = None
