from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class OrganizationBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    pass


class Organization(OrganizationBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UploadTaskBase(BaseModel):
    original_filename: str
    file_size: int
    file_type: str
    organization_id: Optional[int] = None
    uploaded_by: Optional[str] = None


class UploadTaskCreate(UploadTaskBase):
    pass


class UploadTask(UploadTaskBase):
    id: int
    task_id: str
    filename: str
    file_path: str
    file_hash_md5: Optional[str] = None
    file_hash_sha256: Optional[str] = None
    status: str
    isolation_status: str
    scan_engine: Optional[str] = None
    scan_result: Optional[str] = None
    threat_level: str
    uploaded_at: datetime
    scanned_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    raw_input: Optional[str] = None
    processed_result: Optional[str] = None
    notes: Optional[str] = None
    organization: Optional[Organization] = None

    class Config:
        from_attributes = True


class UploadTaskDetail(UploadTask):
    security_logs: List["SecurityLog"] = []


class SecurityLogBase(BaseModel):
    event_type: str
    severity: str
    message: str
    source_ip: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None


class SecurityLogCreate(SecurityLogBase):
    upload_task_id: int


class SecurityLog(SecurityLogBase):
    id: int
    log_id: str
    upload_task_id: int
    created_at: datetime
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScanRuleBase(BaseModel):
    name: str
    rule_type: str
    pattern: str
    description: Optional[str] = None
    severity: str = "medium"
    action: str = "isolate"


class ScanRuleCreate(ScanRuleBase):
    pass


class ScanRule(ScanRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UploadTaskUpdate(BaseModel):
    status: Optional[str] = None
    isolation_status: Optional[str] = None
    notes: Optional[str] = None


class SecurityLogResolve(BaseModel):
    resolved_by: str
    notes: Optional[str] = None


class BatchImportRequest(BaseModel):
    organizations: List[OrganizationCreate]


UploadTaskDetail.model_rebuild()
