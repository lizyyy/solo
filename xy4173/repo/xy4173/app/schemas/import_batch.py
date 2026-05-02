from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ImportBatchBase(BaseModel):
    batch_code: str = Field(..., min_length=1, max_length=50)
    import_type: str = Field(..., min_length=1, max_length=50)
    file_name: Optional[str] = None
    file_size: int = 0
    total_records: int = 0
    imported_records: int = 0
    failed_records: int = 0
    skipped_records: int = 0
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    imported_by: Optional[str] = None
    imported_by_name: Optional[str] = None
    notes: Optional[str] = None


class ImportBatchResponse(ImportBatchBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
