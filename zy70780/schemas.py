from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from models import AuditStatus, PackageStatus


class SourceReportBase(BaseModel):
    registry_url: str
    found: bool = False
    hash_match: bool = False
    response_data: Optional[str] = None
    error_message: Optional[str] = None


class SourceReportCreate(SourceReportBase):
    pass


class SourceReport(SourceReportBase):
    id: int
    package_audit_id: int
    checked_at: datetime

    class Config:
        from_attributes = True


class PackageAuditBase(BaseModel):
    package_name: str
    version: str
    registry: str
    integrity_hash: Optional[str] = None
    expected_hash: Optional[str] = None
    status: PackageStatus = PackageStatus.UNVERIFIED


class PackageAuditCreate(PackageAuditBase):
    pass


class PackageAudit(PackageAuditBase):
    id: int
    lockfile_audit_id: int
    created_at: datetime
    updated_at: datetime
    source_reports: List[SourceReport] = []

    class Config:
        from_attributes = True


class AuditExceptionBase(BaseModel):
    package_name: Optional[str] = None
    original_input: str
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    resolved: bool = False


class AuditExceptionCreate(AuditExceptionBase):
    pass


class AuditExceptionUpdate(BaseModel):
    handler: Optional[str] = None
    conclusion: Optional[str] = None
    resolved: Optional[bool] = None


class AuditException(AuditExceptionBase):
    id: int
    lockfile_audit_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LockfileAuditBase(BaseModel):
    name: str
    lockfile_type: str
    created_by: Optional[str] = None
    notes: Optional[str] = None


class LockfileAuditCreate(LockfileAuditBase):
    content: str


class LockfileAuditUpdate(BaseModel):
    status: Optional[AuditStatus] = None
    notes: Optional[str] = None


class LockfileAudit(LockfileAuditBase):
    id: int
    content_hash: str
    status: AuditStatus
    created_at: datetime
    updated_at: datetime
    packages: List[PackageAudit] = []
    exceptions: List[AuditException] = []

    class Config:
        from_attributes = True


class LockfileAuditList(BaseModel):
    total: int
    items: List[LockfileAudit]


class ManualCorrection(BaseModel):
    package_name: str
    version: str
    correct_registry: str
    correct_hash: Optional[str] = None
    handler: str
    reason: str


class AuditExport(BaseModel):
    lockfile_audit: LockfileAudit
    summary: dict
    exported_at: datetime
