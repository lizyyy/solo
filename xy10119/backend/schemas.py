from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Any, Dict


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AnnotationBase(BaseModel):
    annotator: str
    label: str
    confidence: Optional[float] = 1.0
    reasoning: Optional[str] = None


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationResponse(AnnotationBase):
    id: int
    sample_id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class SampleBase(BaseModel):
    content: str
    external_id: Optional[str] = None
    metadata: Optional[str] = None


class SampleCreate(SampleBase):
    annotations: List[AnnotationCreate] = []


class SampleResponse(SampleBase):
    id: int
    project_id: int
    created_at: datetime
    annotations: List[AnnotationResponse] = []
    
    class Config:
        from_attributes = True


class ReviewDecisionBase(BaseModel):
    reviewer: str
    decision: str
    reasoning: str
    annotation_id: Optional[int] = None


class ReviewDecisionCreate(ReviewDecisionBase):
    pass


class ReviewDecisionResponse(ReviewDecisionBase):
    id: int
    conflict_id: int
    created_at: datetime
    is_final: bool
    
    class Config:
        from_attributes = True


class ConflictBase(BaseModel):
    sample_id: int
    severity: Optional[str] = "medium"
    detection_method: Optional[str] = None


class ConflictResponse(BaseModel):
    id: int
    sample_id: int
    status: str
    severity: str
    detection_method: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    sample: Optional[SampleResponse]
    review_decisions: List[ReviewDecisionResponse] = []
    
    class Config:
        from_attributes = True


class VersionResponse(BaseModel):
    id: int
    project_id: int
    version_number: int
    description: Optional[str]
    action: str
    affected_samples: int
    created_by: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConflictDetectionResult(BaseModel):
    conflict: ConflictResponse
    annotations: List[AnnotationResponse]
    majority_label: Optional[str]
    conflicting_labels: List[str]


class ReportSummary(BaseModel):
    total_samples: int
    total_conflicts: int
    resolved_conflicts: int
    pending_conflicts: int
    conflict_rate: float
    reviewer_consistency: Optional[float]


class ImportRequest(BaseModel):
    project_id: int
    format: str
    data: Optional[List[Dict[str, Any]]] = None
