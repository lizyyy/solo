from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import WheelStatus


class WheelFileBase(BaseModel):
    filename: str
    uploader: Optional[str] = None


class WheelFileCreate(WheelFileBase):
    file_hash: str
    file_size: int
    platform_tag: Optional[str] = None
    python_version: Optional[str] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None
    original_filename: str


class WheelFileUpdate(BaseModel):
    status: Optional[str] = None
    uploader: Optional[str] = None


class WheelFileResponse(WheelFileBase):
    id: int
    status: str
    file_hash: str
    file_size: int
    platform_tag: Optional[str]
    python_version: Optional[str]
    package_name: Optional[str]
    package_version: Optional[str]
    upload_time: datetime

    class Config:
        from_attributes = True


class WheelFileDetail(WheelFileResponse):
    metadata: Optional["MetaDataResponse"] = None
    entry_points: List["EntryPointResponse"] = Field(default_factory=list)
    dependencies: List["DependencyResponse"] = Field(default_factory=list)
    validation_reports: List["ValidationReportResponse"] = Field(default_factory=list)
    exception_paths: List["ExceptionPathResponse"] = Field(default_factory=list)
    audit_logs: List["AuditLogResponse"] = Field(default_factory=list)


class MetaDataBase(BaseModel):
    metadata_version: Optional[str] = None
    name: Optional[str] = None
    version: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    description_content_type: Optional[str] = None
    keywords: Optional[str] = None
    home_page: Optional[str] = None
    author: Optional[str] = None
    author_email: Optional[str] = None
    license: Optional[str] = None
    classifier: Optional[str] = None
    requires_python: Optional[str] = None


class MetaDataCreate(MetaDataBase):
    wheel_file_id: int
    raw_metadata: Optional[str] = None


class MetaDataResponse(MetaDataBase):
    id: int
    wheel_file_id: int

    class Config:
        from_attributes = True


class EntryPointBase(BaseModel):
    group: str
    name: str
    module: str
    attr: Optional[str] = None
    extras: Optional[str] = None


class EntryPointCreate(EntryPointBase):
    wheel_file_id: int
    is_valid: bool = True
    validation_error: Optional[str] = None


class EntryPointResponse(EntryPointBase):
    id: int
    wheel_file_id: int
    is_valid: bool
    validation_error: Optional[str]

    class Config:
        from_attributes = True


class DependencyBase(BaseModel):
    name: str
    specifier: Optional[str] = None
    extras: Optional[str] = None
    environment_marker: Optional[str] = None


class DependencyCreate(DependencyBase):
    wheel_file_id: int
    is_valid: bool = True
    validation_error: Optional[str] = None


class DependencyResponse(DependencyBase):
    id: int
    wheel_file_id: int
    is_valid: bool
    validation_error: Optional[str]

    class Config:
        from_attributes = True


class ValidationReportBase(BaseModel):
    report_type: str
    generated_by: Optional[str] = None
    overall_status: str
    platform_tag_check: Optional[bool] = None
    platform_tag_message: Optional[str] = None
    entry_points_check: Optional[bool] = None
    entry_points_message: Optional[str] = None
    dependencies_check: Optional[bool] = None
    dependencies_message: Optional[str] = None
    metadata_check: Optional[bool] = None
    metadata_message: Optional[str] = None
    raw_report: Optional[str] = None


class ValidationReportCreate(ValidationReportBase):
    wheel_file_id: int


class ValidationReportResponse(ValidationReportBase):
    id: int
    wheel_file_id: int
    generated_at: datetime

    class Config:
        from_attributes = True


class ExceptionPathBase(BaseModel):
    original_input: str
    handler: str
    conclusion: str
    notes: Optional[str] = None


class ExceptionPathCreate(ExceptionPathBase):
    wheel_file_id: int


class ExceptionPathResponse(ExceptionPathBase):
    id: int
    wheel_file_id: int
    handled_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    actor: Optional[str] = None
    reason: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    wheel_file_id: int


class AuditLogResponse(AuditLogBase):
    id: int
    wheel_file_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    new_status: str
    actor: Optional[str] = None
    reason: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    corrected_metadata: Optional[dict] = None
    corrected_entry_points: Optional[List[dict]] = None
    corrected_dependencies: Optional[List[dict]] = None
    corrected_platform_tag: Optional[str] = None
    handler: str
    notes: Optional[str] = None


class ExceptionPathRequest(BaseModel):
    original_input: str
    handler: str
    conclusion: str
    notes: Optional[str] = None


WheelFileDetail.model_rebuild()
