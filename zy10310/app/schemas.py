from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class FieldMappingBase(BaseModel):
    source_field: str
    target_field: str
    mapping_type: str
    transform_rule: Dict[str, Any] = Field(default_factory=dict)


class FieldMappingCreate(FieldMappingBase):
    pass


class FieldMapping(FieldMappingBase):
    id: str
    is_valid: bool
    validation_message: Optional[str]

    class Config:
        from_attributes = True


class DependencyResourceBase(BaseModel):
    resource_type: str
    resource_name: str
    resource_id: Optional[str] = None
    required: bool = True


class DependencyResourceCreate(DependencyResourceBase):
    pass


class DependencyResource(DependencyResourceBase):
    id: str
    status: str
    error_message: Optional[str]

    class Config:
        from_attributes = True


class FixSuggestionBase(BaseModel):
    suggestion_type: str
    title: str
    description: str
    operation_steps: List[str] = Field(default_factory=list)
    auto_fixable: bool = False


class FixSuggestionCreate(FixSuggestionBase):
    pass


class FixSuggestion(FixSuggestionBase):
    id: str

    class Config:
        from_attributes = True


class PrecheckErrorBase(BaseModel):
    error_code: str
    error_type: str
    severity: str
    field: Optional[str] = None
    message: str
    detail: Dict[str, Any] = Field(default_factory=dict)


class PrecheckErrorCreate(PrecheckErrorBase):
    fix_suggestions: List[FixSuggestionCreate] = Field(default_factory=list)


class PrecheckError(PrecheckErrorBase):
    id: str
    resolved: bool
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    fix_suggestions: List[FixSuggestion]

    class Config:
        from_attributes = True


class PassCertificateBase(BaseModel):
    pass


class PassCertificateCreate(PassCertificateBase):
    pass


class PassCertificate(PassCertificateBase):
    id: str
    certificate_number: str
    issued_at: datetime
    issued_by: str
    expires_at: Optional[datetime]
    rules_version: str
    checksum: str
    is_revoked: bool
    revoked_at: Optional[datetime]
    revoked_by: Optional[str]

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    operator: str
    details: Dict[str, Any] = Field(default_factory=dict)


class AuditLogCreate(AuditLogBase):
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLog(AuditLogBase):
    id: str
    old_status: Optional[str]
    new_status: Optional[str]
    timestamp: datetime
    ip_address: Optional[str]
    user_agent: Optional[str]

    class Config:
        from_attributes = True


class ImportPackageBase(BaseModel):
    tenant_id: str
    package_name: str
    package_version: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ImportPackageCreate(ImportPackageBase):
    field_mappings: List[FieldMappingCreate] = Field(default_factory=list)
    dependency_resources: List[DependencyResourceCreate] = Field(default_factory=list)
    source_content: str


class ImportPackageUpdate(BaseModel):
    status: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class ImportPackage(ImportPackageBase):
    id: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    rules_version: str
    source_hash: str
    field_mappings: List[FieldMapping]
    dependency_resources: List[DependencyResource]
    precheck_errors: List[PrecheckError]
    pass_certificates: List[PassCertificate]

    class Config:
        from_attributes = True
        model_fields = {"metadata": {"alias": "metadata_", "default": {}}}


class ImportPackageListItem(BaseModel):
    id: str
    tenant_id: str
    package_name: str
    package_version: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]
    rules_version: str
    error_count: int

    class Config:
        from_attributes = True


class PrecheckResult(BaseModel):
    package_id: str
    status: str
    total_checks: int
    passed_checks: int
    failed_checks: int
    warning_count: int
    errors: List[PrecheckError]


class StatusAdvanceRequest(BaseModel):
    target_status: str
    operator: str
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class RevokeCertificateRequest(BaseModel):
    operator: str
    reason: str


class ExportRequest(BaseModel):
    format: str = "json"
    include_audit_logs: bool = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    error_code: Optional[str] = None
