from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ModelVersionBase(BaseModel):
    version_name: str
    model_name: str
    description: Optional[str] = None

class ModelVersionCreate(ModelVersionBase):
    pass

class ModelVersion(ModelVersionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class EvaluationBase(BaseModel):
    model_version_id: int
    dataset_name: str
    dataset_version: str
    status: str
    total_samples: Optional[int] = None
    passed_samples: Optional[int] = None
    failed_samples: Optional[int] = None
    error_message: Optional[str] = None

class EvaluationCreate(EvaluationBase):
    pass

class StatusUpdate(BaseModel):
    status: str

class Evaluation(EvaluationBase):
    id: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MetricBase(BaseModel):
    evaluation_id: int
    metric_name: str
    metric_value: float
    metric_unit: Optional[str] = None
    threshold: Optional[float] = None
    is_alert: bool = False

class MetricCreate(MetricBase):
    pass

class Metric(MetricBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class MetricComparisonRequest(BaseModel):
    evaluation_ids: List[int]

class MetricComparison(BaseModel):
    metric_name: str
    values: List[dict]

class FailureSampleBase(BaseModel):
    evaluation_id: int
    sample_id: str
    input_data: str
    expected_output: str
    actual_output: str
    error_type: str
    is_resolved: bool = False

class FailureSampleCreate(FailureSampleBase):
    pass

class FailureSampleUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolution_note: Optional[str] = None

class FailureSample(FailureSampleBase):
    id: int
    resolution_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NoteBase(BaseModel):
    evaluation_id: int
    author: str
    content: str

class NoteCreate(NoteBase):
    pass

class Note(NoteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ReleaseSuggestionBase(BaseModel):
    model_version_id: int
    suggestion_type: str
    content: str
    author: str

class ReleaseSuggestionCreate(ReleaseSuggestionBase):
    pass

class ReleaseSuggestion(ReleaseSuggestionBase):
    id: int
    is_approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class EvaluationImport(BaseModel):
    model_version_name: str
    model_name: str
    dataset_name: str
    dataset_version: str
    metrics: List[MetricBase]
    failure_samples: List[FailureSampleBase]
