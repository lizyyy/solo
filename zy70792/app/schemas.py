from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models import TaskStatus


class ArtifactFileBase(BaseModel):
    file_path: str
    file_name: str
    file_size: int
    file_hash: str
    upload_region: str


class ArtifactFileCreate(ArtifactFileBase):
    pass


class ArtifactFile(ArtifactFileBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    original_input: str
    handler: str
    conclusion: str


class ExceptionRecordCreate(ExceptionRecordBase):
    pass


class ExceptionRecord(ExceptionRecordBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class HashTaskBase(BaseModel):
    task_name: str
    artifact_dir: str
    regions: str


class HashTaskCreate(HashTaskBase):
    pass


class HashTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    report: Optional[str] = None


class HashTask(HashTaskBase):
    id: int
    status: TaskStatus
    report: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    files: List[ArtifactFile] = []
    exceptions: List[ExceptionRecord] = []

    class Config:
        from_attributes = True


class ManualCorrection(BaseModel):
    handler: str
    conclusion: str
    original_input: str
    new_status: Optional[TaskStatus] = None


class TaskExport(BaseModel):
    task_id: int
    format: str = "json"
