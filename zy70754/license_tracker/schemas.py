from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from .database import ExceptionStatus, LockfileType


class ErrorCode:
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LicenseExceptionNotFound(Exception):
    pass


class InvalidStatusTransition(Exception):
    pass


class NeedsManualReview(Exception):
    pass


class AlreadyProcessed(Exception):
    pass


class MissingField(Exception):
    def __init__(self, field_name: str):
        self.field_name = field_name
        super().__init__(f"Missing required field: {field_name}")


class DependencyBase(BaseModel):
    name: str
    version: Optional[str] = None
    package_manager: Optional[str] = None
    lockfile_type: Optional[str] = None
    lockfile_path: Optional[str] = None
    license_name: Optional[str] = None
    license_url: Optional[str] = None
    description: Optional[str] = None
    project_path: Optional[str] = None


class DependencyCreate(DependencyBase):
    pass


class Dependency(DependencyBase):
    id: int
    imported_at: datetime
    last_checked_at: datetime

    class Config:
        orm_mode = True


class DependencyPathBase(BaseModel):
    file_path: str
    import_line: Optional[str] = None
    line_number: Optional[int] = None
    module_name: Optional[str] = None


class DependencyPathCreate(DependencyPathBase):
    dependency_id: int


class DependencyPath(DependencyPathBase):
    id: int
    discovered_at: datetime

    class Config:
        orm_mode = True


class LicenseBase(BaseModel):
    name: str
    spdx_identifier: Optional[str] = None
    is_approved: bool = False
    is_copyleft: bool = False
    risk_level: str = "low"
    description: Optional[str] = None
    requirements: Optional[str] = None


class LicenseCreate(LicenseBase):
    pass


class License(LicenseBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class LicenseExceptionBase(BaseModel):
    dependency_name: str
    license_name: str
    reason: str
    requested_by: str
    expires_at: datetime
    requires_manual_review: bool = False


class LicenseExceptionCreate(LicenseExceptionBase):
    dependency_id: Optional[int] = None


class LicenseExceptionUpdate(BaseModel):
    status: Optional[ExceptionStatus] = None
    approved_by: Optional[str] = None
    review_notes: Optional[str] = None
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class LicenseException(LicenseExceptionBase):
    id: int
    dependency_id: Optional[int] = None
    status: ExceptionStatus
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    review_notes: Optional[str] = None

    class Config:
        orm_mode = True


class LockfileImportRequest(BaseModel):
    lockfile_path: str
    project_path: str
    lockfile_type: Optional[LockfileType] = None


class LockfileImportResponse(BaseModel):
    success: bool
    imported_count: int
    dependencies: List[Dependency]
    warnings: List[str]


class ExpiringExceptionAlert(BaseModel):
    exception_id: int
    dependency_name: str
    license_name: str
    expires_at: datetime
    days_until_expiry: int
    status: str


class ExceptionReportItem(BaseModel):
    dependency_name: str
    version: str
    license_name: str
    exception_status: str
    exception_reason: str
    expires_at: Optional[datetime]
    requested_by: Optional[str]
    approved_by: Optional[str]
    project_path: str
    paths: List[str]


class ExceptionReportResponse(BaseModel):
    report_generated_at: datetime
    total_items: int
    pending_review: int
    approved: int
    expiring_30_days: int
    items: List[ExceptionReportItem]
