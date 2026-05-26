from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---- Batch ----

class BatchCreateRequest(BaseModel):
    name: str
    operator: str
    source: str = Field(pattern="^(csv|json|appeal)$")
    meta: Optional[Dict[str, Any]] = None
    remark: Optional[str] = None


class BatchBrief(BaseModel):
    id: int
    name: str
    operator: str
    source: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---- QCItem ----

class QCItemBrief(BaseModel):
    id: int
    batch_id: int
    row_no: int
    agent_id: str
    agent_name: Optional[str] = None
    deduction_item: Optional[str] = None
    deduction_score: float
    original_score: float
    final_score: float
    call_date: Optional[str] = None
    status: str
    handler: Optional[str] = None
    reviewed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class QCItemDetail(QCItemBrief):
    recording_summary: Optional[str] = None
    source_payload: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


# ---- Event ----

class QCEventBrief(BaseModel):
    seq: int
    action: str
    actor: str
    reason: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    detail: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Appeal ----

class AppealBrief(BaseModel):
    id: int
    appellant: str
    content: str
    evidence: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Item with trace ----

class QCItemTrace(BaseModel):
    item: QCItemDetail
    events: List[QCEventBrief]
    appeals: List[AppealBrief]

    class Config:
        from_attributes = True


# ---- Actions ----

class MarkProcessedRequest(BaseModel):
    handler: str
    reason: Optional[str] = None


class ReturnRequest(BaseModel):
    handler: str
    reason: str
    request_material: Optional[bool] = False


class SecondReviewRequest(BaseModel):
    reviewer: str
    reason: str
    adjust_score: Optional[float] = None


class ApproveRequest(BaseModel):
    reviewer: str
    reason: str
    final_score: Optional[float] = None


class RejectRequest(BaseModel):
    reviewer: str
    reason: str


class CancelDeductionRequest(BaseModel):
    handler: str
    reason: str
    deduction_item: Optional[str] = None


class ScoreWritebackRequest(BaseModel):
    handler: str
    reason: str
    final_score: float


# ---- Query ----

class QueryRequest(BaseModel):
    agent_id: Optional[str] = None
    deduction_item: Optional[str] = None
    reviewed_by: Optional[str] = None
    status: Optional[str] = None
    batch_id: Optional[int] = None
    keyword: Optional[str] = None


class QueryResponse(BaseModel):
    total: int
    items: List[QCItemBrief]


class Message(BaseModel):
    message: str
