from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ColdChainBoxBase(BaseModel):
    box_code: str
    batch_no: Optional[str] = None
    product_name: Optional[str] = None
    temperature_min: float = -25.0
    temperature_max: float = -15.0
    expected_arrival: Optional[datetime] = None


class ColdChainBoxCreate(ColdChainBoxBase):
    pass


class ColdChainBoxUpdate(BaseModel):
    status: Optional[str] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None


class ColdChainBox(ColdChainBoxBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TemperatureSampleBase(BaseModel):
    sample_time: datetime
    temperature: float
    probe_id: Optional[str] = None


class TemperatureSampleCreate(TemperatureSampleBase):
    box_code: str


class TemperatureSample(TemperatureSampleBase):
    id: int
    box_id: int
    is_anomaly: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StoreSignoffBase(BaseModel):
    store_code: str
    store_name: Optional[str] = None
    signoff_person: str
    signoff_time: datetime
    temperature_arrival: Optional[float] = None
    has_exception: bool = False
    exception_desc: Optional[str] = None


class StoreSignoffCreate(StoreSignoffBase):
    box_code: str


class StoreSignoffUpdate(BaseModel):
    status: Optional[str] = None
    has_exception: Optional[bool] = None
    exception_desc: Optional[str] = None


class StoreSignoff(StoreSignoffBase):
    id: int
    box_id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PhotoEvidenceBase(BaseModel):
    photo_key: str
    photo_type: Optional[str] = None
    photo_url: Optional[str] = None
    uploader: Optional[str] = None
    description: Optional[str] = None


class PhotoEvidenceCreate(PhotoEvidenceBase):
    box_code: str
    signoff_id: Optional[int] = None


class PhotoEvidence(PhotoEvidenceBase):
    id: int
    box_id: int
    upload_time: datetime

    class Config:
        from_attributes = True


class ExceptionReviewBase(BaseModel):
    reviewer: str
    original_input: Optional[str] = None
    review_result: Optional[str] = None
    review_comment: Optional[str] = None
    temperature_violation: bool = False
    compensation_eligible: bool = False


class ExceptionReviewCreate(ExceptionReviewBase):
    box_code: str
    signoff_id: int


class ExceptionReviewUpdate(BaseModel):
    status: Optional[str] = None
    review_result: Optional[str] = None
    review_comment: Optional[str] = None
    temperature_violation: Optional[bool] = None
    compensation_eligible: Optional[bool] = None


class ExceptionReview(ExceptionReviewBase):
    id: int
    box_id: int
    signoff_id: int
    review_time: datetime
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompensationConclusionBase(BaseModel):
    compensation_amount: float = 0.0
    compensation_reason: Optional[str] = None
    processor: str
    approved_by: Optional[str] = None


class CompensationConclusionCreate(CompensationConclusionBase):
    box_code: str
    review_id: int


class CompensationConclusionUpdate(BaseModel):
    status: Optional[str] = None
    compensation_amount: Optional[float] = None
    compensation_reason: Optional[str] = None


class CompensationConclusion(CompensationConclusionBase):
    id: int
    box_id: int
    review_id: int
    conclusion_time: datetime
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLog(BaseModel):
    id: int
    box_id: Optional[int] = None
    action_type: str
    operator: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    comment: Optional[str] = None
    change_details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BoxDetailResponse(ColdChainBox):
    temperature_samples: List[TemperatureSample] = []
    signoffs: List[StoreSignoff] = []
    photos: List[PhotoEvidence] = []
    reviews: List[ExceptionReview] = []
    compensations: List[CompensationConclusion] = []
    audit_logs: List[AuditLog] = []


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class StatusTransitionRequest(BaseModel):
    target_status: str
    operator: str
    comment: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    field_name: str
    old_value: str
    new_value: str
    operator: str
    reason: str


class ExportRequest(BaseModel):
    box_codes: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[List[str]] = None
    export_format: str = "xlsx"
