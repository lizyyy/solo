from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from pharmacy_expiry_tracker.models.enums import ImportSourceType


class ImportSourceBase(BaseModel):
    source_type: ImportSourceType = Field(..., description="导入源类型")
    file_name: str = Field(..., description="文件名")


class ImportSourceCreate(ImportSourceBase):
    uploaded_by: str = Field(..., description="上传人")
    notes: Optional[str] = Field(None, description="备注")


class ImportSourceResponse(ImportSourceBase):
    id: int
    file_hash: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_by: str
    uploaded_at: datetime
    total_rows: int = 0
    success_rows: int = 0
    failed_rows: int = 0
    is_complete: bool = False
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ImportResultDetail(BaseModel):
    row_number: int
    success: bool
    record_id: Optional[int] = None
    record_no: Optional[str] = None
    error_message: Optional[str] = None


class ImportResult(BaseModel):
    import_source_id: int
    total_rows: int
    success_rows: int
    failed_rows: int
    is_complete: bool
    details: List[ImportResultDetail]
    elapsed_seconds: float
