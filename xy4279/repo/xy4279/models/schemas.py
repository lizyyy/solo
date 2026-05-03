from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class OperationStatus(str, Enum):
    DRAFT = "draft"
    IMPORTED = "imported"
    COMPARED = "compared"
    CHECKED = "checked"
    APPROVED = "approved"
    SIMULATED = "simulated"
    ISSUED = "issued"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"


class CheckResultBase(BaseModel):
    check_type: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    risk_level: str = "medium"


class CheckResultCreate(CheckResultBase):
    operation_id: int


class CheckResultResponse(CheckResultBase):
    id: int
    operation_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SettingValueBase(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    group_name: Optional[str] = None
    is_unchanged: bool = False
    old_value: Optional[str] = None


class SettingValueCreate(SettingValueBase):
    pass


class SettingValueResponse(SettingValueBase):
    id: int
    version_id: int

    class Config:
        from_attributes = True


class SettingVersionBase(BaseModel):
    version: str
    bay_id: str
    bay_name: str
    device_type: str
    device_model: str
    manufacturer: Optional[str] = None
    effective_date: Optional[str] = None
    source_file: Optional[str] = None
    source_type: str = "excel"


class SettingVersionCreate(SettingVersionBase):
    values: List[SettingValueCreate] = []


class SettingVersionResponse(SettingVersionBase):
    id: int
    created_at: datetime
    values: List[SettingValueResponse] = []

    class Config:
        from_attributes = True


class TopologyNodeBase(BaseModel):
    node_id: str
    node_type: str
    name: str
    parent_id: Optional[str] = None
    properties: Optional[Dict[str, Any]] = None


class TopologyNodeCreate(TopologyNodeBase):
    pass


class TopologyNodeResponse(TopologyNodeBase):
    id: int
    topology_id: int

    class Config:
        from_attributes = True


class TopologyRelationBase(BaseModel):
    from_node: str
    to_node: str
    relation_type: str
    properties: Optional[Dict[str, Any]] = None


class TopologyRelationCreate(TopologyRelationBase):
    pass


class TopologyRelationResponse(TopologyRelationBase):
    id: int
    topology_id: int

    class Config:
        from_attributes = True


class TopologyBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_file: Optional[str] = None


class TopologyCreate(TopologyBase):
    nodes: List[TopologyNodeCreate] = []
    relations: List[TopologyRelationCreate] = []


class TopologyResponse(TopologyBase):
    id: int
    created_at: datetime
    nodes: List[TopologyNodeResponse] = []
    relations: List[TopologyRelationResponse] = []

    class Config:
        from_attributes = True


class PlateStateBase(BaseModel):
    plate_id: str
    plate_name: str
    plate_type: str
    current_state: str
    target_state: Optional[str] = None
    sequence: Optional[int] = None
    description: Optional[str] = None
    bay_id: Optional[str] = None


class PlateStateCreate(PlateStateBase):
    pass


class PlateStateResponse(PlateStateBase):
    id: int
    plate_status_id: int

    class Config:
        from_attributes = True


class PlateStatusBase(BaseModel):
    name: str
    bay_id: str
    bay_name: str
    source_file: Optional[str] = None


class PlateStatusCreate(PlateStatusBase):
    plates: List[PlateStateCreate] = []


class PlateStatusResponse(PlateStatusBase):
    id: int
    created_at: datetime
    plates: List[PlateStateResponse] = []

    class Config:
        from_attributes = True


class ApprovalSignatureBase(BaseModel):
    role: str
    signatory: str
    signed: bool = False
    signed_at: Optional[str] = None
    comment: Optional[str] = None
    sequence: int


class ApprovalSignatureCreate(ApprovalSignatureBase):
    pass


class ApprovalSignatureResponse(ApprovalSignatureBase):
    id: int
    ticket_id: int

    class Config:
        from_attributes = True


class ApprovalTicketBase(BaseModel):
    ticket_no: str
    title: str
    status: str = "pending"
    source_file: Optional[str] = None


class ApprovalTicketCreate(ApprovalTicketBase):
    operation_id: Optional[int] = None
    signatures: List[ApprovalSignatureCreate] = []


class ApprovalTicketResponse(ApprovalTicketBase):
    id: int
    operation_id: Optional[int] = None
    created_at: datetime
    signatures: List[ApprovalSignatureResponse] = []

    class Config:
        from_attributes = True


class OperationBase(BaseModel):
    name: str
    description: Optional[str] = None
    bay_id: str
    bay_name: str
    current_version_id: Optional[int] = None
    target_version_id: Optional[int] = None
    topology_id: Optional[int] = None
    plate_status_id: Optional[int] = None
    approval_ticket_id: Optional[int] = None


class OperationCreate(OperationBase):
    pass


class OperationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    current_version_id: Optional[int] = None
    target_version_id: Optional[int] = None
    topology_id: Optional[int] = None
    plate_status_id: Optional[int] = None
    approval_ticket_id: Optional[int] = None


class OperationResponse(OperationBase):
    id: int
    status: OperationStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OperationDetailResponse(OperationResponse):
    check_results: List[CheckResultResponse] = []

    class Config:
        from_attributes = True


class SimulationLogBase(BaseModel):
    step: int
    action: str
    target: Optional[str] = None
    result: str
    message: Optional[str] = None


class SimulationLogResponse(SimulationLogBase):
    id: int
    operation_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    operation: str
    resource_type: str
    resource_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    user: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class RiskQueryResponse(BaseModel):
    risk_type: str
    description: str
    affected_items: List[Dict[str, Any]]
    risk_level: str
    mitigation: str


class VersionCompareResult(BaseModel):
    version_current: str
    version_target: str
    bay_id: str
    bay_name: str
    total_values: int
    changed_values: int
    unchanged_values: int
    added_values: int
    removed_values: int
    changes: List[Dict[str, Any]]
    additions: List[Dict[str, Any]]
    removals: List[Dict[str, Any]]


class InterlockCheckResult(BaseModel):
    operation_id: int
    check_type: str
    passed: bool
    message: str
    details: Dict[str, Any]
    risk_level: str
    suggestions: List[str] = []


class ImportResponse(BaseModel):
    success: bool
    message: str
    resource_type: str
    resource_id: int
    records_count: int = 0
