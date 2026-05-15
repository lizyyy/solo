from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    EARLY_TERMINATED = "early_terminated"


class RiskType(str, Enum):
    SECURITY = "security"
    DATA_INTEGRITY = "data_integrity"
    NETWORK = "network"
    DEVICE_HEALTH = "device_health"
    CONFIGURATION = "configuration"
    UNKNOWN = "unknown"


class EdgeNodeBase(BaseModel):
    node_id: str
    node_name: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    responsibility_team: Optional[str] = None


class EdgeNodeCreate(EdgeNodeBase):
    pass


class EdgeNode(EdgeNodeBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskBatchBase(BaseModel):
    batch_id: str
    batch_name: Optional[str] = None
    operator: str
    risk_type: Optional[RiskType] = RiskType.UNKNOWN
    remarks: Optional[str] = None


class TaskBatchCreate(TaskBatchBase):
    pass


class TaskBatch(TaskBatchBase):
    id: int
    status: TaskStatus
    total_tasks: int
    success_count: int
    failed_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskResultBase(BaseModel):
    task_id: str
    batch_id: str
    node_id: str
    is_early_terminated: bool = False
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    raw_output: Optional[str] = None


class TaskResultCreate(TaskResultBase):
    pass


class TaskResult(TaskResultBase):
    id: int
    status: TaskStatus
    executed_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttributionRuleBase(BaseModel):
    rule_code: str
    rule_name: str
    description: Optional[str] = None
    condition_pattern: str
    risk_type: RiskType = RiskType.UNKNOWN
    priority: int = 0


class AttributionRuleCreate(AttributionRuleBase):
    pass


class AttributionRule(AttributionRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AttributionResultBase(BaseModel):
    task_id: str
    batch_id: str
    blocked_by_rule: Optional[str] = None
    blocked_by_rule_code: Optional[str] = None
    block_reason: Optional[str] = None
    risk_type: RiskType = RiskType.UNKNOWN
    confidence_score: float = 0.0


class AttributionResultCreate(AttributionResultBase):
    pass


class ManualModifyRequest(BaseModel):
    new_conclusion: str
    modified_by: str


class AttributionResult(AttributionResultBase):
    id: int
    is_manual_modified: bool
    modified_by: Optional[str] = None
    modified_at: Optional[datetime] = None
    original_conclusion: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IoTReceiptBase(BaseModel):
    receipt_id: str
    node_id: str
    task_id: str
    receipt_type: str
    raw_data: str
    responsibility_team: Optional[str] = None


class IoTReceiptCreate(IoTReceiptBase):
    pass


class IoTReceipt(IoTReceiptBase):
    id: int
    received_at: datetime

    class Config:
        from_attributes = True


class RollbackCandidateBase(BaseModel):
    candidate_id: str
    batch_id: str
    task_ids: str
    reason: str
    risk_level: str
    created_by: str


class RollbackCandidateCreate(RollbackCandidateBase):
    pass


class RollbackCandidate(RollbackCandidateBase):
    id: int
    is_approved: bool
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AttributionAnalysisRequest(BaseModel):
    batch_id: str
    edge_node_inventory: Optional[List[EdgeNodeCreate]] = None


class AttributionResponse(BaseModel):
    batch_id: str
    total_tasks: int
    early_terminated_count: int
    blocked_tasks: List[dict]
    summary: str


class RollbackCandidateResponse(BaseModel):
    candidate_id: str
    batch_id: str
    task_count: int
    task_ids: List[str]
    reason: str
    risk_level: str
    created_by: str
    created_at: datetime
