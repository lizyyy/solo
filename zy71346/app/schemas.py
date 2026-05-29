from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from .models import TaskStatus, AnomalyType, AudioType


class DenoiseParamsBase(BaseModel):
    name: str
    params_json: Dict[str, Any]
    source: Optional[str] = None
    manual_notes: Optional[str] = None


class DenoiseParamsCreate(DenoiseParamsBase):
    pass


class DenoiseParamsUpdate(BaseModel):
    name: Optional[str] = None
    params_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    manual_notes: Optional[str] = None


class DenoiseParamsResponse(DenoiseParamsBase):
    id: int
    task_id: int
    version: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AudioSegmentBase(BaseModel):
    audio_type: AudioType
    name: str
    file_path: str
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    source_metadata: Optional[Dict[str, Any]] = None
    manual_notes: Optional[str] = None


class AudioSegmentCreate(AudioSegmentBase):
    pass


class AudioSegmentUpdate(BaseModel):
    name: Optional[str] = None
    manual_notes: Optional[str] = None


class AudioSegmentResponse(AudioSegmentBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ListeningRecordBase(BaseModel):
    audio_segment_id: int
    params_id: Optional[int] = None
    listener: Optional[str] = None
    naturalness_score: Optional[int] = Field(None, ge=0, le=100)
    noise_reduction_score: Optional[int] = Field(None, ge=0, le=100)
    overall_score: Optional[int] = Field(None, ge=0, le=100)
    has_artifacts: bool = False
    has_echo: bool = False
    has_muffled: bool = False
    comments: Optional[str] = None
    manual_notes: Optional[str] = None


class ListeningRecordCreate(ListeningRecordBase):
    pass


class ListeningRecordUpdate(BaseModel):
    naturalness_score: Optional[int] = Field(None, ge=0, le=100)
    noise_reduction_score: Optional[int] = Field(None, ge=0, le=100)
    overall_score: Optional[int] = Field(None, ge=0, le=100)
    comments: Optional[str] = None
    manual_notes: Optional[str] = None


class ListeningRecordResponse(ListeningRecordBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingResultBase(BaseModel):
    audio_segment_id: int
    params_id: int
    output_file_path: Optional[str] = None
    snr_before: Optional[float] = None
    snr_after: Optional[float] = None
    snr_improvement: Optional[float] = None
    voice_preservation_rate: Optional[float] = Field(None, ge=0, le=100)
    noise_reduction_rate: Optional[float] = Field(None, ge=0, le=100)
    duration: Optional[float] = None
    processing_time: Optional[float] = None
    metrics: Optional[Dict[str, Any]] = None
    manual_notes: Optional[str] = None


class ProcessingResultCreate(ProcessingResultBase):
    pass


class ProcessingResultUpdate(BaseModel):
    manual_notes: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


class ProcessingResultResponse(ProcessingResultBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyRecordBase(BaseModel):
    anomaly_type: AnomalyType
    severity: str = "warning"
    message: str
    suggestion: Optional[str] = None
    params_id: Optional[int] = None
    audio_segment_id: Optional[int] = None


class AnomalyRecordCreate(AnomalyRecordBase):
    pass


class AnomalyRecordResolve(BaseModel):
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None


class AnomalyRecordResponse(AnomalyRecordBase):
    id: int
    task_id: int
    detected_at: datetime
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ComparisonReportBase(BaseModel):
    report_type: str = "full"
    format: str = "xlsx"
    exported_by: Optional[str] = None


class ComparisonReportExport(ComparisonReportBase):
    pass


class ComparisonReportResponse(ComparisonReportBase):
    id: int
    task_id: int
    batch_no: str
    name: str
    file_path: str
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ComparisonTaskBase(BaseModel):
    name: str
    description: Optional[str] = None
    created_by: Optional[str] = None
    manual_notes: Optional[str] = None
    source_metadata: Optional[Dict[str, Any]] = None


class ComparisonTaskCreate(ComparisonTaskBase):
    batch_no: Optional[str] = None


class ComparisonTaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    manual_notes: Optional[str] = None


class ComparisonTaskStatusUpdate(BaseModel):
    status: TaskStatus
    updated_by: Optional[str] = None
    notes: Optional[str] = None


class ComparisonTaskImport(BaseModel):
    audio_segments: List[AudioSegmentCreate] = Field(default_factory=list)
    params: List[DenoiseParamsCreate] = Field(default_factory=list)
    listening_records: List[ListeningRecordCreate] = Field(default_factory=list)


class ComparisonTaskResponse(ComparisonTaskBase):
    id: int
    batch_no: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    params_count: int = 0
    audio_segments_count: int = 0
    listening_records_count: int = 0
    processing_results_count: int = 0
    anomalies_count: int = 0
    reports_count: int = 0

    class Config:
        from_attributes = True


class ComparisonTaskDetailResponse(ComparisonTaskResponse):
    params: List[DenoiseParamsResponse] = Field(default_factory=list)
    audio_segments: List[AudioSegmentResponse] = Field(default_factory=list)
    listening_records: List[ListeningRecordResponse] = Field(default_factory=list)
    processing_results: List[ProcessingResultResponse] = Field(default_factory=list)
    anomalies: List[AnomalyRecordResponse] = Field(default_factory=list)
    reports: List[ComparisonReportResponse] = Field(default_factory=list)


class BatchProcessRequest(BaseModel):
    task_id: int
    audio_segment_ids: Optional[List[int]] = None
    params_ids: Optional[List[int]] = None


class BatchProcessResponse(BaseModel):
    task_id: int
    total_combinations: int
    processed_count: int
    anomalies_detected: List[AnomalyRecordResponse] = Field(default_factory=list)


class MetricsComparison(BaseModel):
    params_id: int
    params_name: str
    version: int
    avg_snr_improvement: float
    avg_voice_preservation: float
    avg_noise_reduction: float
    avg_naturalness_score: float
    avg_overall_score: float
    anomaly_count: int


class TaskMetricsResponse(BaseModel):
    task_id: int
    batch_no: str
    total_segments: int
    total_params: int
    comparisons: List[MetricsComparison] = Field(default_factory=list)
