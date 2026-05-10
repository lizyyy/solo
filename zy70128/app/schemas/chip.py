from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponse


class ChipDataCreate(BaseModel):
    chip_id: str
    bib_number: Optional[str] = None
    athlete_id: Optional[str] = None
    timing_point: str
    timestamp: datetime
    raw_data: Optional[str] = None


class ChipDataResponse(BaseResponse):
    batch_id: int
    chip_id: str
    bib_number: Optional[str]
    athlete_id: Optional[str]
    timing_point: str
    timestamp: datetime
    raw_data: Optional[str]
    is_valid: bool
    validation_error: Optional[str]


class ChipBatchCreate(BaseModel):
    race_id: int
    batch_name: str
    imported_by: Optional[str] = None
    notes: Optional[str] = None


class ChipBatchResponse(BaseResponse):
    race_id: int
    batch_name: str
    import_status: str
    total_records: int
    processed_records: int
    error_count: int
    imported_by: Optional[str]
    notes: Optional[str]
    chip_data: List[ChipDataResponse] = []


class ChipImportRequest(BaseModel):
    batch_name: str
    race_id: int
    chip_data: List[ChipDataCreate]
    imported_by: Optional[str] = None
    notes: Optional[str] = None
