from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from models import ExportRequestStatus, ApprovalNodeType


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


class UserSubjectBase(BaseModel):
    user_id: str
    name: str
    email: str


class UserSubjectCreate(UserSubjectBase):
    pass


class UserSubjectResponse(UserSubjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConsentVersionBase(BaseModel):
    version: str
    consent_type: str
    agreed_at: datetime


class ConsentVersionCreate(ConsentVersionBase):
    user_subject_id: int


class ConsentVersionResponse(ConsentVersionBase):
    id: int
    user_subject_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ExportScopeBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    data_categories: Optional[str] = None


class ExportScopeCreate(ExportScopeBase):
    pass


class ExportScopeResponse(ExportScopeBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRequestScopeCreate(BaseModel):
    scope_code: str


class ExportRequestBase(BaseModel):
    request_id: str
    user_subject_id: int
    consent_version_id: int
    requester_notes: Optional[str] = None


class ExportRequestCreate(ExportRequestBase):
    scopes: List[str] = Field(..., description="List of export scope codes")

    @field_validator('scopes')
    @classmethod
    def scopes_not_empty(cls, v):
        if not v:
            raise ValueError('At least one scope must be specified')
        return v


class ExportRequestUpdate(BaseModel):
    status: Optional[ExportRequestStatus] = None
    legal_notes: Optional[str] = None
    requester_notes: Optional[str] = None


class ExportRequestResponse(BaseModel):
    id: int
    request_id: str
    user_subject_id: int
    consent_version_id: int
    status: ExportRequestStatus
    requested_at: datetime
    requester_notes: Optional[str]
    legal_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApprovalBase(BaseModel):
    node_type: ApprovalNodeType
    approver_name: Optional[str] = None
    approver_email: Optional[str] = None
    notes: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    export_request_id: int
    approved: bool


class ApprovalResponse(ApprovalBase):
    id: int
    export_request_id: int
    approved: Optional[bool]
    approved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PackageTaskBase(BaseModel):
    task_id: str


class PackageTaskCreate(PackageTaskBase):
    export_request_id: int


class PackageTaskUpdate(BaseModel):
    status: Optional[str] = None
    package_url: Optional[str] = None
    package_checksum: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class PackageTaskResponse(PackageTaskBase):
    id: int
    export_request_id: int
    status: str
    package_url: Optional[str]
    package_checksum: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryRecordBase(BaseModel):
    delivered_to: str
    delivery_method: str
    tracking_number: Optional[str] = None
    notes: Optional[str] = None


class DeliveryRecordCreate(DeliveryRecordBase):
    export_request_id: int


class DeliveryRecordResponse(DeliveryRecordBase):
    id: int
    export_request_id: int
    delivered_at: datetime
    confirmed_receipt: bool
    confirmed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ExportRequestFilter(BaseModel):
    status: Optional[ExportRequestStatus] = None
    user_subject_id: Optional[int] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
