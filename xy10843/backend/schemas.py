from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class AnnotatorBase(BaseModel):
    name: str
    email: str

class AnnotatorCreate(AnnotatorBase):
    pass

class Annotator(AnnotatorBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SampleBase(BaseModel):
    content: str
    original_annotation: Optional[str] = None

class SampleCreate(SampleBase):
    pass

class Sample(SampleBase):
    id: int
    current_annotation: Optional[str]
    status: str
    locked_by: Optional[int]
    locked_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class TaskPackageBase(BaseModel):
    name: str
    annotator_id: int

class TaskPackageCreate(TaskPackageBase):
    sample_ids: List[int]

class TaskPackage(TaskPackageBase):
    id: int
    status: str
    assigned_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class TaskItemBase(BaseModel):
    pass

class TaskItem(TaskItemBase):
    id: int
    package_id: int
    sample_id: int
    status: str
    annotation_result: Optional[str]
    annotated_at: Optional[datetime]
    sample: Sample

    class Config:
        from_attributes = True

class SkipRecordBase(BaseModel):
    sample_id: int
    annotator_id: int
    reason: str

class SkipRecordCreate(SkipRecordBase):
    pass

class SkipRecord(SkipRecordBase):
    id: int
    reviewed: bool
    review_result: Optional[str]
    review_note: Optional[str]
    reviewed_by: Optional[int]
    reviewed_at: Optional[datetime]
    created_at: datetime
    sample: Sample

    class Config:
        from_attributes = True

class ReworkRecordBase(BaseModel):
    sample_id: int
    requester_id: int
    original_annotation: str
    reason: str

class ReworkRecordCreate(ReworkRecordBase):
    pass

class ReworkRecord(ReworkRecordBase):
    id: int
    status: str
    rework_annotation: Optional[str]
    reworked_at: Optional[datetime]
    created_at: datetime
    sample: Sample

    class Config:
        from_attributes = True

class ReviewSkipRequest(BaseModel):
    review_result: str
    review_note: Optional[str] = None
    reviewed_by: int

class SubmitAnnotationRequest(BaseModel):
    annotation_result: str

class CompleteReworkRequest(BaseModel):
    rework_annotation: str

class StatisticsResponse(BaseModel):
    total_samples: int
    pending_samples: int
    completed_samples: int
    skipped_samples: int
    rework_samples: int
    total_tasks: int
    completed_tasks: int
    pending_skips: int
    pending_reworks: int