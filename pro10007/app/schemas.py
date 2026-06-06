from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class WarningRecordResponse(BaseModel):
    id: int
    account_no: str
    customer_id: str
    warning_type: str
    warning_level: str
    warning_message: str
    related_materials: Optional[str]
    is_extended: bool
    extension_days: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewRecordCreate(BaseModel):
    warning_id: int
    reviewer: str = Field(..., description="复核员姓名")
    review_result: str = Field(..., description="复核结果：通过/需进一步核实/驳回")
    review_comments: Optional[str] = Field(None, description="复核意见")
    exception_explanation: Optional[str] = Field(None, description="异常说明，可直接转发给相关人员")


class ReviewRecordResponse(BaseModel):
    id: int
    warning_id: int
    reviewer: str
    review_result: str
    review_comments: Optional[str]
    exception_explanation: Optional[str]
    reviewed_at: datetime
    is_exported: bool

    class Config:
        from_attributes = True


class WarningWithReviewResponse(WarningRecordResponse):
    review: Optional[ReviewRecordResponse] = None


class DataImportResponse(BaseModel):
    success: bool
    file_name: str
    total_records: int
    valid_records: int
    invalid_records: int
    cleaning_notes: str
    import_log_id: int


class WarningRunResponse(BaseModel):
    success: bool
    new_warnings: int
    skipped_duplicates: int
    total_warnings: int


class CustomerStats(BaseModel):
    customer_id: str
    customer_name: Optional[str]
    account_count: int
    total_outstanding: float
    warning_count: int


class ExportReviewResponse(BaseModel):
    success: bool
    export_count: int
    export_content: str
