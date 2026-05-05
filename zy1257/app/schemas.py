from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class NodeRole(str, Enum):
    master = "master"
    slave = "slave"


class SlotState(str, Enum):
    stable = "stable"
    migrating = "migrating"
    importing = "importing"


class TaskStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ResultStatus(str, Enum):
    success = "success"
    failed = "failed"
    redirected = "redirected"
    timeout = "timeout"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class NodeBase(BaseModel):
    node_id: str
    host: str
    port: int
    role: NodeRole = NodeRole.master
    master_id: Optional[str] = None
    state: str = "connected"
    is_alive: bool = True


class NodeCreate(NodeBase):
    pass


class NodeResponse(NodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SlotBase(BaseModel):
    slot_number: int
    owner_node_id: Optional[str] = None
    importing_node_id: Optional[str] = None
    migrating_node_id: Optional[str] = None
    state: SlotState = SlotState.stable
    is_migrating: bool = False
    is_importing: bool = False


class SlotCreate(SlotBase):
    pass


class SlotResponse(SlotBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RequestBase(BaseModel):
    request_id: Optional[str] = None
    command: str
    key: Optional[str] = None
    key_slot: Optional[int] = None
    is_read: bool = True
    is_write: bool = False
    is_lua: bool = False
    is_transaction: bool = False
    timestamp: datetime
    original_data: Optional[Dict[str, Any]] = None


class RequestCreate(RequestBase):
    pass


class RequestResponse(RequestBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DrillTaskBase(BaseModel):
    task_name: str
    description: Optional[str] = None
    
    enable_moved_redirect: bool = True
    enable_ask_redirect: bool = True
    enable_read_write_routing: bool = True
    enable_replication_lag: bool = False
    enable_sentinel_failover: bool = False
    enable_client_retry: bool = True
    enable_lua_transaction_failure: bool = False
    
    replication_lag_ms: int = 0
    max_retries: int = 3
    seed: int = 42


class DrillTaskCreate(DrillTaskBase):
    pass


class DrillTaskResponse(DrillTaskBase):
    id: int
    status: TaskStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DrillResultBase(BaseModel):
    result_type: str
    request_id: Optional[str] = None
    slot_number: Optional[int] = None
    node_id: Optional[str] = None
    
    status: ResultStatus = ResultStatus.success
    redirect_type: Optional[str] = None
    redirect_count: int = 0
    retry_count: int = 0
    latency_ms: float = 0.0
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    
    details: Optional[Dict[str, Any]] = None


class DrillResultCreate(DrillResultBase):
    task_id: int


class DrillResultResponse(DrillResultBase):
    id: int
    task_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class DiagnosisBase(BaseModel):
    diagnosis_type: str
    severity: Severity = Severity.info
    title: str
    description: Optional[str] = None
    recommendation: Optional[str] = None
    
    affected_slots: Optional[List[int]] = None
    affected_nodes: Optional[List[str]] = None
    affected_requests: Optional[List[str]] = None
    
    details: Optional[Dict[str, Any]] = None


class DiagnosisCreate(DiagnosisBase):
    task_id: int


class DiagnosisResponse(DiagnosisBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    nodes_imported: int
    slots_imported: int
    requests_imported: int
    slot_events_imported: int


class RiskAnalysis(BaseModel):
    task_id: int
    total_risks: int
    critical_risks: int
    high_risks: int
    medium_risks: int
    low_risks: int
    risks: List[DiagnosisResponse]


class ComparisonResult(BaseModel):
    task_ids: List[int]
    comparison_metrics: Dict[str, Any]
    insights: List[str]


class ReportExport(BaseModel):
    format: str
    content: str
    filename: str


class StatsResponse(BaseModel):
    total_nodes: int
    total_slots: int
    total_requests: int
    total_tasks: int
    total_diagnoses: int
