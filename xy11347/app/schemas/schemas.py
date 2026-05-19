from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from app.models.models import QCStatus, UserRole, ImportSource


class UserBase(BaseModel):
    username: str = Field(..., max_length=50)
    full_name: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.QC_OPERATOR


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class OrderBase(BaseModel):
    order_no: str = Field(..., max_length=50)
    product_name: str = Field(..., max_length=200)
    customer: Optional[str] = Field(None, max_length=100)
    paper_batch: Optional[str] = Field(None, max_length=100)
    paper_type: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = None
    target_l: Optional[float] = None
    target_a: Optional[float] = None
    target_b: Optional[float] = None
    tolerance_l: float = 2.0
    tolerance_a: float = 2.0
    tolerance_b: float = 2.0
    operator: Optional[str] = Field(None, max_length=50)
    print_date: Optional[datetime] = None
    remarks: Optional[str] = None


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: int
    status: QCStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ColorMeasurementBase(BaseModel):
    order_no: str = Field(..., max_length=50)
    measurement_no: Optional[str] = Field(None, max_length=50)
    measure_point: Optional[str] = Field(None, max_length=100)
    l_value: float
    a_value: float
    b_value: float
    paper_batch: Optional[str] = Field(None, max_length=100)
    measure_time: Optional[datetime] = None
    operator: Optional[str] = Field(None, max_length=50)
    equipment: Optional[str] = Field(None, max_length=100)


class ColorMeasurementCreate(ColorMeasurementBase):
    pass


class ColorMeasurementResponse(ColorMeasurementBase):
    id: int
    order_id: Optional[int]
    delta_l: Optional[float]
    delta_a: Optional[float]
    delta_b: Optional[float]
    delta_e: Optional[float]
    is_pass: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True


class ReworkRecordBase(BaseModel):
    order_no: str = Field(..., max_length=50)
    rework_type: Optional[str] = Field(None, max_length=100)
    rework_reason: str
    rework_count: int = 1
    operator: Optional[str] = Field(None, max_length=50)
    rework_date: Optional[datetime] = None
    remarks: Optional[str] = None


class ReworkRecordCreate(ReworkRecordBase):
    pass


class ReworkRecordResponse(ReworkRecordBase):
    id: int
    order_id: Optional[int]
    before_status: Optional[QCStatus]
    after_status: Optional[QCStatus]
    created_at: datetime

    class Config:
        from_attributes = True


class QCReportBase(BaseModel):
    order_no: str = Field(..., max_length=50)
    total_measurements: int = 0
    pass_count: int = 0
    fail_count: int = 0
    pass_rate: Optional[float] = None
    avg_delta_e: Optional[float] = None
    max_delta_e: Optional[float] = None
    min_delta_e: Optional[float] = None
    rework_count: int = 0
    review_remarks: Optional[str] = None


class QCReportCreate(QCReportBase):
    pass


class QCReportResponse(QCReportBase):
    id: int
    report_no: str
    conclusion: Optional[QCStatus]
    reviewer: Optional[str]
    review_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    qc_report_id: int
    review_action: str = Field(..., max_length=100)
    review_notes: Optional[str] = None
    after_status: QCStatus


class ReviewRecordCreate(ReviewRecordBase):
    pass


class ReviewRecordResponse(ReviewRecordBase):
    id: int
    reviewer: str
    before_status: Optional[QCStatus]
    review_date: datetime

    class Config:
        from_attributes = True


class ImportErrorRecordBase(BaseModel):
    import_source: ImportSource
    file_name: Optional[str] = Field(None, max_length=255)
    row_number: Optional[int] = None
    original_data: str
    error_type: Optional[str] = Field(None, max_length=100)
    error_message: str
    suggestion: Optional[str] = None


class ImportErrorRecordCreate(ImportErrorRecordBase):
    pass


class ImportErrorRecordResponse(ImportErrorRecordBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    correction_note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    error_records: List[ImportErrorRecordResponse]


class QCRuleBase(BaseModel):
    rule_name: str = Field(..., max_length=100)
    rule_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    condition_expression: str
    is_active: bool = True
    priority: int = 0


class QCRuleCreate(QCRuleBase):
    pass


class QCRuleResponse(QCRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TrendDataPoint(BaseModel):
    date: str
    pass_rate: float
    avg_delta_e: float
    total_count: int


class TrendAnalysisResponse(BaseModel):
    paper_batch: str
    data_points: List[TrendDataPoint]


class ErrorCorrection(BaseModel):
    correction_note: str
    corrected_data: Optional[dict] = None
