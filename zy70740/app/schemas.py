from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from .models import JobStatus, GPUModel


class JobBase(BaseModel):
    job_id: str
    gpu_model: GPUModel
    gpu_count: int
    estimated_duration: float
    priority: int
    user: str


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    status: Optional[JobStatus] = None
    priority: Optional[int] = None


class JobResponse(JobBase):
    id: int
    status: JobStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    queue_position: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ReleaseEventCreate(BaseModel):
    job_id: str
    released_gpus: int
    gpu_model: GPUModel
    released_by: str


class ReleaseEventResponse(BaseModel):
    id: int
    job_id: str
    released_gpus: int
    gpu_model: str
    released_at: datetime
    released_by: str

    model_config = ConfigDict(from_attributes=True)


class ExceptionRecordCreate(BaseModel):
    original_input: str
    handler: str
    conclusion: str


class ExceptionRecordResponse(BaseModel):
    id: int
    original_input: str
    handler: str
    conclusion: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GPUResourceCreate(BaseModel):
    gpu_model: GPUModel
    total: int
    available: int


class QueueSummary(BaseModel):
    gpu_model: str
    total_jobs: int
    pending_jobs: int
    running_jobs: int
    avg_priority: float
    estimated_wait_time: float


class QueueExport(BaseModel):
    jobs: List[JobResponse]
    summary: List[QueueSummary]
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)