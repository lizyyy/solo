from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponse


class ResultRecordCreate(BaseModel):
    athlete_id: str
    athlete_name: str
    bib_number: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    rank: Optional[int] = None
    category: Optional[str] = None
    status: str = "FINISHED"
    source: Optional[str] = None


class ResultRecordResponse(BaseResponse):
    version_id: int
    athlete_id: str
    athlete_name: str
    bib_number: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_seconds: Optional[float]
    rank: Optional[int]
    category: Optional[str]
    status: str
    source: Optional[str]


class ResultVersionCreate(BaseModel):
    race_id: int
    notes: Optional[str] = None
    created_by: Optional[str] = None
    records: List[ResultRecordCreate] = []


class ResultVersionResponse(BaseResponse):
    race_id: int
    version_number: int
    is_latest: bool
    is_public: bool
    published_at: Optional[datetime]
    notes: Optional[str]
    created_by: Optional[str]
    records: List[ResultRecordResponse] = []
