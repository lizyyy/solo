from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import IssueType, RecordStatus


class FullScoreCreate(BaseModel):
    title: str = Field(..., max_length=256)
    composer: str = Field(..., max_length=128)
    version: str = Field(..., max_length=32)
    measure_count: int = Field(..., gt=0)


class FullScoreRead(BaseModel):
    id: int
    title: str
    composer: str
    version: str
    measure_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PartScoreCreate(BaseModel):
    full_score_id: int
    voice_part: str = Field(..., max_length=64)
    version: str = Field(..., max_length=32)
    measure_start: int = Field(..., ge=0)
    measure_end: int = Field(..., ge=0)
    page_count: int = Field(..., ge=0)


class PartScoreRead(BaseModel):
    id: int
    full_score_id: int
    voice_part: str
    version: str
    measure_start: int
    measure_end: int
    page_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProofreadRecordRead(BaseModel):
    id: int
    full_score_id: int
    part_score_id: int
    issue_type: IssueType
    status: RecordStatus
    explanation: str
    detail: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProofreadResult(BaseModel):
    full_score_id: int
    total_issues: int
    issues: list[ProofreadRecordRead]


class StatusTransition(BaseModel):
    target_status: RecordStatus


class ProofreadRecordFilter(BaseModel):
    status: Optional[RecordStatus] = None
    issue_type: Optional[IssueType] = None
