from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ValidationError


class ChangeType(str, Enum):
    FIELD_REMOVED = "field_removed"
    TYPE_CHANGED = "type_changed"
    ENUM_CHANGED = "enum_changed"
    REQUIRED_ADDED = "required_added"
    FIELD_ADDED = "field_added"
    REQUIRED_REMOVED = "required_removed"


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ConfirmationStatus(str, Enum):
    UNCONFIRMED = "unconfirmed"
    CONFIRMED = "confirmed"
    NOT_APPLICABLE = "not_applicable"


class FieldDefinition(BaseModel):
    name: str
    type: str
    required: bool = False
    description: Optional[str] = None
    enum_values: Optional[List[str]] = None
    default: Optional[Any] = None


class EndpointDefinition(BaseModel):
    path: str
    method: str = "GET"
    summary: Optional[str] = None
    description: Optional[str] = None
    request_body: Optional[List[FieldDefinition]] = None
    response_body: Optional[List[FieldDefinition]] = None
    query_params: Optional[List[FieldDefinition]] = None
    path_params: Optional[List[FieldDefinition]] = None


class ApiContract(BaseModel):
    api_name: str
    version: str
    service_name: str
    endpoints: List[EndpointDefinition]
    updated_at: Optional[datetime] = None


class CallerInfo(BaseModel):
    service_name: str
    team_name: str
    owner: Optional[str] = None
    email: Optional[str] = None
    endpoints_called: List[str]
    call_volume: Optional[int] = None
    last_called_at: Optional[datetime] = None


class AlertInfo(BaseModel):
    id: str
    service_name: str
    message: str
    level: str = "warning"
    created_at: datetime
    related_endpoint: Optional[str] = None


class ManualNote(BaseModel):
    id: str
    service_name: str
    content: str
    author: Optional[str] = None
    created_at: datetime
    related_endpoint: Optional[str] = None


class FieldChange(BaseModel):
    change_type: ChangeType
    path: str
    field_name: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    location: str


class EndpointChange(BaseModel):
    endpoint_path: str
    method: str
    changes: List[FieldChange]


class ApiDiff(BaseModel):
    api_name: str
    old_version: str
    new_version: str
    service_name: str
    endpoint_changes: List[EndpointChange]
    computed_at: datetime


class CallerImpact(BaseModel):
    service_name: str
    team_name: str
    owner: Optional[str]
    endpoints_affected: List[str]
    changes: List[FieldChange]
    risk_level: RiskLevel
    confirmation_status: ConfirmationStatus
    alerts: List[AlertInfo] = []
    notes: List[ManualNote] = []
    requires_action: bool = True


class ChangeAnalysis(BaseModel):
    diff_id: str
    api_diff: ApiDiff
    caller_impacts: List[CallerImpact]
    generated_at: datetime
    notes: List[ManualNote] = []
    alerts: List[AlertInfo] = []


def parse_contract(data: Dict[str, Any]) -> ApiContract:
    try:
        return ApiContract(**data)
    except ValidationError as e:
        raise ValueError(f"契约格式错误: {e}")


def parse_caller(data: Dict[str, Any]) -> CallerInfo:
    try:
        return CallerInfo(**data)
    except ValidationError as e:
        raise ValueError(f"调用方格式错误: {e}")
