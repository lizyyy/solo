from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class SamplingPointBase(BaseModel):
    point_code: str
    point_name: str
    location: Optional[str] = None
    river_basin: Optional[str] = None


class SamplingPointCreate(SamplingPointBase):
    pass


class SamplingPointUpdate(BaseModel):
    point_name: Optional[str] = None
    location: Optional[str] = None
    river_basin: Optional[str] = None
    is_active: Optional[bool] = None


class SamplingPointResponse(SamplingPointBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnitBase(BaseModel):
    unit_code: str
    unit_name: str
    dimension: str
    conversion_factor: float = 1.0
    base_unit_id: Optional[int] = None


class UnitCreate(UnitBase):
    pass


class UnitResponse(UnitBase):
    id: int

    class Config:
        from_attributes = True


class ParameterBase(BaseModel):
    param_code: str
    param_name: str
    default_unit_id: Optional[int] = None


class ParameterCreate(ParameterBase):
    pass


class ParameterResponse(ParameterBase):
    id: int

    class Config:
        from_attributes = True


class ThresholdBase(BaseModel):
    parameter_id: int
    water_grade: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    unit_id: int


class ThresholdCreate(ThresholdBase):
    pass


class ThresholdResponse(ThresholdBase):
    id: int

    class Config:
        from_attributes = True


class FieldRecordBase(BaseModel):
    record_code: str
    sampling_point_id: int
    sampling_time: datetime
    collector: str
    weather: Optional[str] = None
    temperature: Optional[float] = None
    remark: Optional[str] = None


class FieldRecordCreate(FieldRecordBase):
    pass


class FieldRecordUpdate(BaseModel):
    weather: Optional[str] = None
    temperature: Optional[float] = None
    remark: Optional[str] = None
    status: Optional[str] = None


class FieldRecordResponse(FieldRecordBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class LabResultBase(BaseModel):
    field_record_id: int
    parameter_id: int
    raw_value: float
    raw_unit_id: int
    analyst: Optional[str] = None
    analysis_time: Optional[datetime] = None
    remark: Optional[str] = None


class LabResultCreate(LabResultBase):
    pass


class LabResultUpdate(BaseModel):
    raw_value: Optional[float] = None
    raw_unit_id: Optional[int] = None
    analyst: Optional[str] = None
    analysis_time: Optional[datetime] = None
    remark: Optional[str] = None


class LabResultResponse(BaseModel):
    id: int
    field_record_id: int
    parameter_id: int
    raw_value: float
    raw_unit_id: int
    converted_value: Optional[float] = None
    standard_unit_id: Optional[int] = None
    analyst: Optional[str] = None
    is_approved: bool
    approver: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalRequest(BaseModel):
    operator: str
    conclusion: Optional[str] = None


class CorrectionRequest(BaseModel):
    operator: str
    conclusion: str
    raw_value: Optional[float] = None
    raw_unit_id: Optional[int] = None
    remark: Optional[str] = None


class ReviewReportBase(BaseModel):
    report_code: str
    field_record_ids: List[int]
    reviewer: str


class ReviewReportCreate(ReviewReportBase):
    pass


class ReviewReportResponse(BaseModel):
    id: int
    report_code: str
    field_record_ids: str
    reviewer: str
    review_time: datetime
    status: str
    conclusion: Optional[str] = None
    issues: Optional[str] = None
    missing_samples: Optional[str] = None

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    operation_type: str
    entity_type: str
    entity_id: Optional[int] = None
    operator: str
    conclusion: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
