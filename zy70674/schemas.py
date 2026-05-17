from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Any
from enum import Enum


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_REVIEW = "needs_review"
    ALREADY_PROCESSED = "already_processed"
    INVALID_TIME_RANGE = "invalid_time_range"
    RESOURCE_NOT_FOUND = "resource_not_found"
    DUPLICATE_ENTRY = "duplicate_entry"


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class BedBase(BaseModel):
    bed_number: str
    ward: str
    department: str
    bed_type: Optional[str] = None


class BedCreate(BedBase):
    pass


class BedResponse(BedBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PatientBase(BaseModel):
    patient_id: str
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    diagnosis: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AdmissionBase(BaseModel):
    admission_number: str
    patient_id: str
    bed_id: int
    ward: str
    department: str
    admission_time: datetime
    discharge_time: Optional[datetime] = None
    is_pre_discharge: bool = False
    pre_discharge_time: Optional[datetime] = None


class AdmissionCreate(AdmissionBase):
    pass


class AdmissionUpdate(BaseModel):
    discharge_time: Optional[datetime] = None
    is_pre_discharge: Optional[bool] = None
    pre_discharge_time: Optional[datetime] = None
    status: Optional[str] = None


class AdmissionResponse(AdmissionBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TransferRecordBase(BaseModel):
    admission_number: str
    patient_id: str
    from_ward: str
    to_ward: str
    from_bed_id: int
    to_bed_id: int
    transfer_time: datetime
    transfer_reason: Optional[str] = None
    operator: Optional[str] = None


class TransferRecordCreate(TransferRecordBase):
    pass


class TransferRecordResponse(TransferRecordBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class TurnoverIntervalBase(BaseModel):
    bed_id: int
    bed_number: str
    ward: str
    patient_id: str
    patient_name: str
    admission_number: str
    interval_start: datetime
    interval_end: datetime
    duration_hours: float
    interval_type: str
    is_abnormal: bool = False
    abnormal_reason: Optional[str] = None
    is_pre_discharge: bool = False
    has_transfer: bool = False
    transfer_count: int = 0
    needs_review: bool = False


class TurnoverIntervalCreate(TurnoverIntervalBase):
    report_id: Optional[str] = None


class TurnoverIntervalResponse(TurnoverIntervalBase):
    id: int
    report_id: Optional[str]
    status: str
    review_notes: Optional[str]
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TurnoverReportBase(BaseModel):
    report_name: str
    ward: str
    start_date: datetime
    end_date: datetime


class TurnoverReportCreate(TurnoverReportBase):
    generated_by: Optional[str] = None
    notes: Optional[str] = None


class TurnoverReportResponse(TurnoverReportBase):
    id: int
    report_id: str
    total_intervals: int
    abnormal_intervals: int
    transfer_count: int
    pre_discharge_count: int
    average_turnover_hours: float
    status: str
    generated_by: Optional[str]
    generated_at: datetime
    exported_at: Optional[datetime]
    notes: Optional[str]
    
    class Config:
        from_attributes = True


class TurnoverCalculationRequest(BaseModel):
    ward: str
    start_date: datetime
    end_date: datetime
    report_name: Optional[str] = None
    generated_by: Optional[str] = None
    abnormal_threshold_hours: float = 24.0
    
    @validator('end_date')
    def end_date_must_be_after_start(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class TurnoverCalculationResponse(BaseModel):
    report_id: str
    report_name: str
    ward: str
    start_date: datetime
    end_date: datetime
    total_intervals: int
    abnormal_intervals: int
    transfer_count: int
    pre_discharge_count: int
    average_turnover_hours: float
    intervals: List[TurnoverIntervalResponse]


class ReviewRequest(BaseModel):
    interval_ids: List[int]
    review_notes: str
    reviewed_by: str
    approve: bool = True


class BatchImportResponse(BaseModel):
    success_count: int
    failed_count: int
    errors: List[dict]
