from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class CsvFileBase(BaseModel):
    file_name: str


class CsvFileCreate(CsvFileBase):
    pass


class CsvFileResponse(CsvFileBase):
    id: int
    file_hash: str
    file_size: int
    detected_encoding: Optional[str]
    detected_confidence: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ColumnMappingBase(BaseModel):
    original_column: str
    normalized_column: str
    is_ignored: bool = False


class ColumnMappingResponse(ColumnMappingBase):
    id: int
    csv_file_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ColumnMappingUpdate(BaseModel):
    normalized_column: Optional[str] = None
    is_ignored: Optional[bool] = None


class NullRuleBase(BaseModel):
    column_name: str
    null_values: List[str]


class NullRuleResponse(NullRuleBase):
    id: int
    csv_file_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BadRowResponse(BaseModel):
    id: int
    csv_file_id: int
    row_number: int
    raw_data: str
    error_message: str
    is_fixed: bool
    fixed_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class BadRowFixRequest(BaseModel):
    fixed_data: Dict[str, Any]
    handler: str


class RebuildRequest(BaseModel):
    handler: str


class ConversionSummaryResponse(BaseModel):
    id: int
    csv_file_id: int
    total_rows: int
    success_rows: int
    failed_rows: int
    skipped_rows: int
    output_path: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    csv_file_id: int
    action: str
    handler: str
    original_input: Dict[str, Any]
    conclusion: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    status: str
    handler: str
    conclusion: Optional[str] = None


class CsvFileDetailResponse(CsvFileResponse):
    column_mappings: List[ColumnMappingResponse]
    null_rules: List[NullRuleResponse]
    bad_rows: List[BadRowResponse]
    conversion_summary: Optional[ConversionSummaryResponse]
    audit_logs: List[AuditLogResponse]

    class Config:
        from_attributes = True


class ConversionRequest(BaseModel):
    handler: str
    auto_detect_encoding: bool = True
    custom_encoding: Optional[str] = None
