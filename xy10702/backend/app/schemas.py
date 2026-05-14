from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class OAuthSessionBase(BaseModel):
    state: str
    client_id: Optional[str] = None
    redirect_uri: Optional[str] = None
    scope: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class OAuthSessionCreate(OAuthSessionBase):
    pass


class OAuthSessionUpdate(BaseModel):
    status: Optional[str] = None
    status_path: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class OAuthSessionResponse(OAuthSessionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    status: str
    status_path: str
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class CallbackLogBase(BaseModel):
    state: str
    code: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None
    query_params: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class CallbackLogCreate(CallbackLogBase):
    session_id: Optional[int] = None


class CallbackLogResponse(CallbackLogBase):
    id: int
    session_id: Optional[int] = None
    received_at: datetime

    class Config:
        from_attributes = True


class TokenExchangeBase(BaseModel):
    state: str
    code: Optional[str] = None
    grant_type: Optional[str] = None
    request_params: Optional[Dict[str, Any]] = None


class TokenExchangeCreate(TokenExchangeBase):
    session_id: Optional[int] = None


class TokenExchangeUpdate(BaseModel):
    response_data: Optional[Dict[str, Any]] = None
    status_code: Optional[int] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None
    success: Optional[bool] = None
    completed_at: Optional[datetime] = None


class TokenExchangeResponse(TokenExchangeBase):
    id: int
    session_id: Optional[int] = None
    response_data: Optional[Dict[str, Any]] = None
    status_code: Optional[int] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: Optional[str] = None
    scope: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None
    success: bool
    requested_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimelineEventBase(BaseModel):
    event_type: str
    title: str
    description: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    status: str
    path: str


class TimelineEventCreate(TimelineEventBase):
    session_id: int


class TimelineEventResponse(TimelineEventBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


class SessionDetailResponse(OAuthSessionResponse):
    callbacks: List[CallbackLogResponse] = []
    token_exchanges: List[TokenExchangeResponse] = []
    timeline_events: List[TimelineEventResponse] = []


class ExportRequest(BaseModel):
    export_type: str
    format: str
    filters: Optional[Dict[str, Any]] = None


class ExportRecordResponse(BaseModel):
    id: int
    export_type: str
    format: str
    filename: str
    file_path: str
    record_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_sessions: int
    success_count: int
    blocked_count: int
    compensation_count: int
    review_count: int
    pending_count: int
    success_rate: float
    avg_duration_seconds: Optional[float] = None


class DiffCompareRequest(BaseModel):
    session_id_1: int
    session_id_2: int


class DiffResponse(BaseModel):
    session1: SessionDetailResponse
    session2: SessionDetailResponse
    differences: Dict[str, Any]


class RecalculateRequest(BaseModel):
    session_id: int
