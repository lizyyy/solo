from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None
    path: str
    method: str = "GET"
    status: str = "active"
    delay_ms: int = 0
    response_template: Dict[str, Any] = Field(default_factory=dict)
    scenario_params: Dict[str, Any] = Field(default_factory=dict)

class ScenarioCreate(ScenarioBase):
    pass

class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    method: Optional[str] = None
    status: Optional[str] = None
    delay_ms: Optional[int] = None
    response_template: Optional[Dict[str, Any]] = None
    scenario_params: Optional[Dict[str, Any]] = None

class ScenarioResponse(ScenarioBase):
    id: int
    share_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ApprovalBase(BaseModel):
    scenario_id: int
    approver: str
    action: str
    comment: Optional[str] = None
    old_params: Optional[Dict[str, Any]] = None
    new_params: Optional[Dict[str, Any]] = None
    old_response: Optional[Dict[str, Any]] = None
    new_response: Optional[Dict[str, Any]] = None

class ApprovalCreate(ApprovalBase):
    pass

class ApprovalResponse(ApprovalBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TimelineBase(BaseModel):
    scenario_id: int
    action: str
    actor: str
    details: Optional[Dict[str, Any]] = None

class TimelineCreate(TimelineBase):
    pass

class TimelineResponse(TimelineBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class MockRequest(BaseModel):
    path: str
    method: str = "GET"
    headers: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None

class MockResponse(BaseModel):
    status: str
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    delay_ms: int = 0

    class Config:
        from_attributes = True

class ShareTokenResponse(BaseModel):
    share_token: str
    share_url: str

class ScenarioDetailResponse(ScenarioResponse):
    approvals: List[ApprovalResponse] = []
    timeline: List[TimelineResponse] = []

    class Config:
        from_attributes = True