from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional


class ApplicantBase(BaseModel):
    name: str
    email: EmailStr
    company: str


class ApplicantCreate(ApplicantBase):
    pass


class Applicant(ApplicantBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationBase(BaseModel):
    api_scopes: str
    validity_days: int
    reason: str


class ApplicationCreate(ApplicationBase):
    applicant_name: str
    applicant_email: EmailStr
    applicant_company: str


class Application(ApplicationBase):
    id: int
    applicant_id: int
    status: str
    reviewer_comment: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    applicant: Applicant

    model_config = {"from_attributes": True}


class CredentialBase(BaseModel):
    api_key: str
    scopes: str
    status: str
    issued_at: datetime
    expires_at: datetime


class Credential(CredentialBase):
    id: int
    application_id: int
    revoked_at: Optional[datetime] = None
    revoked_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class CredentialWithSecret(Credential):
    api_secret: str


class AuditLogBase(BaseModel):
    action: str
    endpoint: Optional[str] = None
    method: Optional[str] = None
    status: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    error_message: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    credential_id: int


class AuditLog(AuditLogBase):
    id: int
    timestamp: datetime

    model_config = {"from_attributes": True}


class ApprovalRequest(BaseModel):
    application_id: int
    approved: bool
    reviewer_comment: Optional[str] = None


class RevokeRequest(BaseModel):
    credential_id: int
    reason: str


class AccessRequest(BaseModel):
    api_key: str
    api_secret: str
    endpoint: str
    method: str
