from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ConfigVersionBase(BaseModel):
    config_key: str
    version: str
    content: Dict[str, Any]
    description: Optional[str] = None

class ConfigVersionCreate(ConfigVersionBase):
    created_by: str

class ConfigVersionResponse(ConfigVersionBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class GrayscaleRuleBase(BaseModel):
    name: str
    idc_list: Optional[List[str]] = None
    tenant_list: Optional[List[str]] = None
    percentage: float = Field(ge=0, le=100)
    match_mode: str = "any"

class GrayscaleRuleCreate(GrayscaleRuleBase):
    config_version_id: int
    created_by: str

class GrayscaleRuleResponse(GrayscaleRuleBase):
    id: int
    config_version_id: int
    status: str
    created_by: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ApprovalRequestBase(BaseModel):
    title: str
    approver: str

class ApprovalRequestCreate(ApprovalRequestBase):
    rule_id: int
    applicant: str

class ApprovalRequestResponse(ApprovalRequestBase):
    id: int
    rule_id: int
    applicant: str
    status: str
    comment: Optional[str] = None
    approval_at: Optional[datetime] = None
    created_at: datetime
    rollback_reason: Optional[str] = None
    rollback_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ApprovalAction(BaseModel):
    approval_id: int
    operator: str
    approved: bool
    comment: Optional[str] = None

class InstanceAckBase(BaseModel):
    instance_id: str
    idc: Optional[str] = None
    tenant: Optional[str] = None

class InstanceAckCreate(InstanceAckBase):
    rule_id: int
    ack_content: Optional[Dict[str, Any]] = None
    success: bool = True

class InstanceAckResponse(InstanceAckBase):
    id: int
    rule_id: int
    status: str
    ack_content: Optional[Dict[str, Any]] = None
    ack_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class GrayscaleMatchRequest(BaseModel):
    idc: Optional[str] = None
    tenant: Optional[str] = None
    instance_id: str

class GrayscaleMatchResponse(BaseModel):
    should_apply: bool
    rule_id: Optional[int] = None
    config_version_id: Optional[int] = None
    reason: str

class RollbackRequest(BaseModel):
    rule_id: int
    operator: str
    reason: str

class AuditLogResponse(BaseModel):
    id: int
    rule_id: Optional[int]
    approval_id: Optional[int]
    action: str
    operator: str
    details: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ConfigResolveRequest(BaseModel):
    config_key: str
    idc: Optional[str] = None
    tenant: Optional[str] = None
    instance_id: str

class ConfigResolveResponse(BaseModel):
    config_key: str
    version: str
    content: Dict[str, Any]
    source: str
