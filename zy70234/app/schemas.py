from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.models import ProjectType, QueueStatus


class CheckProjectBase(BaseModel):
    name: str
    code: str
    project_type: str = Field(description="项目类型: fasting(空腹)/post_meal(餐后)/unrestricted(无限制)")
    description: Optional[str] = None
    estimated_minutes: int = 15


class CheckProjectCreate(CheckProjectBase):
    pass


class CheckProjectResponse(CheckProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ProjectDependencyBase(BaseModel):
    dependent_project_id: int
    dependency_project_id: int
    dependency_type: str = "required"


class ProjectDependencyCreate(ProjectDependencyBase):
    pass


class ProjectDependencyResponse(ProjectDependencyBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class PackageProjectItem(BaseModel):
    project_id: int
    sort_order: int


class PackageBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class PackageCreate(PackageBase):
    projects: List[PackageProjectItem]


class PackageResponse(PackageBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class PatientBase(BaseModel):
    name: str
    id_card: str
    phone: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientResponse(PatientBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class QueueNumberBase(BaseModel):
    patient_id: int
    package_id: int
    project_id: int
    source: Optional[str] = None


class QueueNumberCreate(QueueNumberBase):
    pass


class QueueNumberResponse(BaseModel):
    id: int
    queue_number: str
    patient_id: int
    package_id: int
    project_id: int
    status: str
    estimated_start_time: Optional[datetime] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    source: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class QueueNumberBatchCreate(BaseModel):
    patient_id: int
    package_id: int
    source: Optional[str] = None


class QueueStatusUpdate(BaseModel):
    new_status: str


class ProblemRecordResponse(BaseModel):
    id: int
    source_endpoint: str
    source_data: dict
    error_message: str
    error_type: str
    created_at: datetime

    class Config:
        orm_mode = True


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    error_type: str
    detail: Optional[dict] = None
