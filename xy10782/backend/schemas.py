from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class AudioRecordBase(BaseModel):
    filename: str
    duration: Optional[float] = None
    transcription: Optional[str] = None
    noise_tags: Optional[str] = None
    sampling_rate: Optional[float] = 1.0

class AudioRecordCreate(AudioRecordBase):
    pass

class AudioRecordUpdate(BaseModel):
    transcription: Optional[str] = None
    noise_tags: Optional[str] = None
    status: Optional[str] = None
    sampling_rate: Optional[float] = None

class AudioRecordResponse(AudioRecordBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class QualityCheckBase(BaseModel):
    check_type: str
    result: str
    error_reason: Optional[str] = None
    confidence: Optional[float] = None
    operator: str

class QualityCheckCreate(QualityCheckBase):
    audio_record_id: int

class QualityCheckResponse(QualityCheckBase):
    id: int
    checked_at: datetime
    
    class Config:
        orm_mode = True

class ApprovalRecordBase(BaseModel):
    action: str
    approver: str
    comment: Optional[str] = None

class ApprovalRecordCreate(ApprovalRecordBase):
    audio_record_id: int

class ApprovalRecordResponse(ApprovalRecordBase):
    id: int
    approved_at: datetime
    
    class Config:
        orm_mode = True

class TimeLineBase(BaseModel):
    event_type: str
    event_description: str
    operator: str

class TimeLineCreate(TimeLineBase):
    audio_record_id: int

class TimeLineResponse(TimeLineBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class AudioRecordDetail(AudioRecordResponse):
    quality_checks: List[QualityCheckResponse] = []
    approval_records: List[ApprovalRecordResponse] = []
    time_lines: List[TimeLineResponse] = []

class QualityFlowRequest(BaseModel):
    audio_record_id: int
    flow_type: str
    operator: str
    comment: Optional[str] = None
    error_reason: Optional[str] = None

class StatisticsResponse(BaseModel):
    date: str
    total_count: int
    success_count: int
    blocked_count: int
    compensation_count: int
    manual_review_count: int
    avg_confidence: float
    
    class Config:
        orm_mode = True

class ExportRequest(BaseModel):
    export_type: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    exported_by: str
