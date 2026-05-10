from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import FieldChangeType, ChangeStatus, AlertStatus, FieldType


class FieldDefinition(BaseModel):
    name: str
    type: str
    nullable: bool = True
    description: Optional[str] = None
    default_value: Optional[Any] = None
    position: Optional[int] = None


class TableMetadataCreate(BaseModel):
    database_name: str
    schema_name: str
    table_name: str
    description: Optional[str] = None
    fields: List[FieldDefinition]


class TableMetadataResponse(BaseModel):
    id: int
    database_name: str
    schema_name: str
    table_name: str
    current_version: int
    description: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class TableFieldVersionResponse(BaseModel):
    id: int
    table_id: int
    version: int
    fields: List[FieldDefinition]
    change_log: Optional[Dict[str, Any]]
    change_reason: Optional[str]
    created_by: Optional[str]
    created_at: datetime
    is_active: bool
    hash_value: str

    class Config:
        from_attributes = True


class LineageEdgeCreate(BaseModel):
    source_table_id: int
    source_field_name: Optional[str]
    target_table_id: int
    target_field_name: Optional[str]
    transformation_logic: Optional[str] = None
    job_id: Optional[str] = None
    job_name: Optional[str] = None


class LineageEdgeResponse(BaseModel):
    id: int
    source_table_id: int
    source_field_name: Optional[str]
    target_table_id: int
    target_field_name: Optional[str]
    transformation_logic: Optional[str]
    job_id: Optional[str]
    job_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FieldChangeRequestCreate(BaseModel):
    table_id: int
    change_type: FieldChangeType
    field_name: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    created_by: Optional[str] = None


class FieldChangeRequestResponse(BaseModel):
    id: int
    request_id: str
    table_id: int
    change_type: FieldChangeType
    field_name: str
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    reason: Optional[str]
    status: ChangeStatus
    created_by: Optional[str]
    created_at: datetime
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    applied_at: Optional[datetime]
    rollback_reason: Optional[str]
    rollback_by: Optional[str]
    rollback_at: Optional[datetime]

    class Config:
        from_attributes = True


class ImpactAnalysisResponse(BaseModel):
    id: int
    analysis_id: str
    change_request_id: int
    analysis_type: str
    impacted_tables: List[Dict[str, Any]]
    impacted_jobs: Optional[List[Dict[str, Any]]]
    impacted_metrics: Optional[List[Dict[str, Any]]]
    risk_level: str
    summary: Optional[str]
    details: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionCreate(BaseModel):
    table_id: int
    subscriber_id: str
    subscriber_name: Optional[str] = None
    subscriber_email: Optional[str] = None
    notification_channel: str = "email"


class SubscriptionResponse(BaseModel):
    id: int
    table_id: int
    subscriber_id: str
    subscriber_name: Optional[str]
    subscriber_email: Optional[str]
    notification_channel: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    alert_id: str
    change_request_id: int
    subscriber_id: Optional[str]
    alert_type: str
    title: str
    message: str
    status: AlertStatus
    created_at: datetime
    sent_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]

    class Config:
        from_attributes = True


class OperationHistoryResponse(BaseModel):
    id: int
    operation_type: str
    entity_type: str
    entity_id: int
    entity_key: Optional[str]
    old_state: Optional[Dict[str, Any]]
    new_state: Optional[Dict[str, Any]]
    operation_by: Optional[str]
    operation_at: datetime
    batch_id: Optional[str]
    comment: Optional[str]

    class Config:
        from_attributes = True


class MetricDefinitionCreate(BaseModel):
    metric_id: str
    metric_name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    calculation_logic: str
    source_tables: List[str]
    source_fields: List[Dict[str, Any]]


class MetricDefinitionResponse(BaseModel):
    id: int
    metric_id: str
    metric_name: str
    description: Optional[str]
    owner: Optional[str]
    calculation_logic: str
    source_tables: List[str]
    source_fields: List[Dict[str, Any]]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ImpactReportResponse(BaseModel):
    id: int
    report_id: str
    analysis_id: int
    report_type: str
    content: Dict[str, Any]
    generated_at: datetime
    generated_by: Optional[str]

    class Config:
        from_attributes = True


class BatchOperationRequest(BaseModel):
    batch_id: Optional[str] = None
    operations: List[Dict[str, Any]]
    comment: Optional[str] = None
    operator: Optional[str] = None


class ChangeApprovalRequest(BaseModel):
    approved_by: str
    comment: Optional[str] = None


class RollbackRequest(BaseModel):
    reason: str
    rolled_back_by: str


class VersionCompareRequest(BaseModel):
    table_id: int
    version1: int
    version2: int


class VersionCompareResponse(BaseModel):
    table_id: int
    version1: int
    version2: int
    added_fields: List[Dict[str, Any]]
    removed_fields: List[Dict[str, Any]]
    modified_fields: List[Dict[str, Any]]
    unchanged_fields: List[Dict[str, Any]]
