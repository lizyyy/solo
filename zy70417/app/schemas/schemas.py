from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class EdgeNodeCreate(BaseModel):
    node_id: str
    node_name: str
    region: str
    group: str
    hardware_model: str
    software_version: str
    ip_address: str
    deployment_time: Optional[datetime] = None
    responsible_team: str
    extra_data: Optional[Dict[str, Any]] = None


class BatchSubmitRequest(BaseModel):
    batch_no: str
    operator: str
    nodes: List[EdgeNodeCreate]


class RuleCreate(BaseModel):
    name: str
    code: str
    description: str
    risk_type: str
    condition: Dict[str, Any]


class RuleResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str
    risk_type: str
    condition: Dict[str, Any]
    version: int
    is_active: bool
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EdgeNodeResponse(BaseModel):
    id: int
    node_id: str
    node_name: str
    region: str
    group: str
    hardware_model: str
    software_version: str
    ip_address: str
    responsible_team: str
    extra_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CheckResultResponse(BaseModel):
    id: int
    rule_code: str
    rule_name: str
    risk_type: str
    is_blocked: bool
    block_reason: Optional[str]
    details: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class BatchListResponse(BaseModel):
    id: int
    batch_no: str
    operator: str
    status: str
    total_count: int
    risk_count: int
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class BatchDetailResponse(BaseModel):
    id: int
    batch_no: str
    operator: str
    status: str
    total_count: int
    risk_count: int
    rule_version_snapshot: Optional[Dict[str, Any]]
    created_at: datetime
    completed_at: Optional[datetime]
    nodes: List[EdgeNodeResponse]
    results: List[CheckResultResponse]

    class Config:
        from_attributes = True


class SubmitResponse(BaseModel):
    success: bool
    batch_no: str
    is_duplicate: bool
    message: str
    detail_url: Optional[str] = None


class BlockedDetail(BaseModel):
    node_id: str
    node_name: str
    rule_code: str
    rule_name: str
    risk_type: str
    block_reason: str
    details: Dict[str, Any]


class ReportResponse(BaseModel):
    batch_no: str
    operator: str
    total_count: int
    risk_count: int
    blocked_details: List[BlockedDetail]
    rule_snapshot: Dict[str, Any]
    generated_at: datetime
