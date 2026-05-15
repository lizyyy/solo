from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SchemaVersionBase(BaseModel):
    schema_name: str
    version: str
    fields: Dict[str, Any]
    created_by: Optional[str] = None
    description: Optional[str] = None


class SchemaVersionCreate(SchemaVersionBase):
    pass


class SchemaVersionResponse(SchemaVersionBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class ConsumerBase(BaseModel):
    name: str
    team: Optional[str] = None
    email: Optional[str] = None
    subscribed_schema_id: Optional[int] = None
    subscribed_fields: Optional[List[str]] = None


class ConsumerCreate(ConsumerBase):
    pass


class ConsumerResponse(ConsumerBase):
    id: int
    status: str
    created_at: datetime
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompatibilityRuleBase(BaseModel):
    rule_name: str
    rule_type: str
    description: Optional[str] = None
    severity: str = "error"


class CompatibilityRuleCreate(CompatibilityRuleBase):
    pass


class CompatibilityRuleResponse(CompatibilityRuleBase):
    id: int
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChangeRequestBase(BaseModel):
    schema_id: int
    title: str
    change_type: Optional[str] = None
    old_schema: Dict[str, Any]
    new_schema: Dict[str, Any]
    created_by: Optional[str] = None
    comments: Optional[str] = None


class ChangeRequestCreate(ChangeRequestBase):
    pass


class ChangeRequestStatusUpdate(BaseModel):
    status: str
    approved_by: Optional[str] = None
    comments: Optional[str] = None


class ChangeRequestResponse(ChangeRequestBase):
    id: int
    request_id: str
    status: str
    created_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    compatibility_result: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class InterceptRecordBase(BaseModel):
    change_request_id: int
    consumer_id: int
    reason: str
    severity: str = "error"
    failed_sample: Optional[Dict[str, Any]] = None


class InterceptRecordCreate(InterceptRecordBase):
    pass


class InterceptRecordResolve(BaseModel):
    resolved_by: str
    resolution_note: str


class InterceptRecordResponse(InterceptRecordBase):
    id: int
    intercept_time: datetime
    status: str
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None

    class Config:
        from_attributes = True


class ImpactReportBase(BaseModel):
    change_request_id: int
    report_type: str
    generated_by: Optional[str] = None


class ImpactReportCreate(ImpactReportBase):
    pass


class ImpactReportResponse(ImpactReportBase):
    id: int
    generated_at: datetime
    affected_consumers: Optional[List[Dict[str, Any]]] = None
    breaking_changes: Optional[List[Dict[str, Any]]] = None
    recommendations: Optional[List[str]] = None

    class Config:
        from_attributes = True


class CompatibilityCheckResult(BaseModel):
    is_compatible: bool
    breaking_changes: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    affected_consumers: List[Dict[str, Any]]
    recommendations: List[str]


class ExportRequest(BaseModel):
    change_request_id: Optional[int] = None
    consumer_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    format: str = "xlsx"


class StatusTransitionRequest(BaseModel):
    target_status: str
    comments: Optional[str] = None
    actor: Optional[str] = None
