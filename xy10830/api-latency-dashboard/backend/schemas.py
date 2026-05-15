from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class SlowRequestSampleBase(BaseModel):
    request_id: str
    tenant_id: str
    latency: float
    timestamp: datetime
    http_method: str
    status_code: int
    user_agent: Optional[str] = None
    client_ip: Optional[str] = None


class IncidentCreate(BaseModel):
    api_path: str
    avg_latency: float
    p95_latency: float
    p99_latency: float
    total_requests: int
    slow_requests: int
    samples: List[SlowRequestSampleBase]
    start_time: datetime


class IncidentResponse(BaseModel):
    id: int
    incident_id: str
    api_path: str
    status: str
    severity: str
    avg_latency: float
    p95_latency: float
    p99_latency: float
    total_requests: int
    slow_requests: int
    affected_tenants: int
    tenant_list: str
    start_time: datetime
    end_time: Optional[datetime]
    current_bucket: str
    recovery_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class IncidentListResponse(BaseModel):
    total: int
    incidents: List[IncidentResponse]


class SlowRequestSampleResponse(BaseModel):
    id: int
    request_id: str
    tenant_id: str
    latency: float
    timestamp: datetime
    http_method: str
    status_code: int
    user_agent: Optional[str]
    client_ip: Optional[str]

    class Config:
        orm_mode = True


class IncidentTimelineResponse(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    event_message: str
    from_status: Optional[str]
    to_status: Optional[str]
    operator: Optional[str]

    class Config:
        orm_mode = True


class TroubleshootRemarkCreate(BaseModel):
    author: str
    content: str
    is_resolution: bool = False


class TroubleshootRemarkResponse(BaseModel):
    id: int
    timestamp: datetime
    author: str
    content: str
    is_resolution: bool

    class Config:
        orm_mode = True


class IncidentDetailResponse(BaseModel):
    incident: IncidentResponse
    samples: List[SlowRequestSampleResponse]
    timeline: List[IncidentTimelineResponse]
    remarks: List[TroubleshootRemarkResponse]


class StatusUpdateRequest(BaseModel):
    new_status: str
    operator: str
    notes: Optional[str] = None


class BatchImportItem(BaseModel):
    api_path: str
    avg_latency: float
    p95_latency: float
    p99_latency: float
    total_requests: int
    slow_requests: int
    start_time: datetime
    tenant_ids: List[str]


class BatchImportRequest(BaseModel):
    items: List[BatchImportItem]
    operator: str
