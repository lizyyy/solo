from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AddressBase(BaseModel):
    original_address: str
    geocoding_result: Optional[str] = None
    candidate_coordinates: Optional[str] = None
    manual_correction: Optional[str] = None
    delivery_range: Optional[str] = None
    hit_report: Optional[str] = None


class AddressCreate(AddressBase):
    pass


class AddressUpdate(BaseModel):
    original_address: Optional[str] = None
    geocoding_result: Optional[str] = None
    candidate_coordinates: Optional[str] = None
    manual_correction: Optional[str] = None
    delivery_range: Optional[str] = None
    hit_report: Optional[str] = None
    status: Optional[str] = None
    is_failed: Optional[bool] = None
    failure_reason: Optional[str] = None


class AddressResponse(AddressBase):
    id: int
    status: str
    is_failed: bool
    failure_reason: Optional[str] = None
    geocoding_version: str
    created_at: datetime
    updated_at: datetime
    processed_by: Optional[int] = None
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AddressListResponse(BaseModel):
    total: int
    items: List[AddressResponse]


class OperationLogResponse(BaseModel):
    id: int
    record_id: int
    operator_id: int
    operator_username: str
    operation_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    review_result: str
    review_comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    address_record_id: int
    reviewer_id: int
    reviewer_username: str
    review_result: str
    review_comment: Optional[str] = None
    reviewed_at: datetime

    class Config:
        from_attributes = True


class AddressDetailResponse(AddressResponse):
    operations: List[OperationLogResponse] = []
    reviews: List[ReviewResponse] = []


class BatchCompareRequest(BaseModel):
    record_ids: List[int]


class ManualCorrectionRequest(BaseModel):
    manual_correction: str
    reason: str


class ExportRequest(BaseModel):
    record_ids: Optional[List[int]] = None
    status: Optional[str] = None
    is_failed: Optional[bool] = None
    format: str = "xlsx"


class RecalculateRequest(BaseModel):
    geocoding_version: str
