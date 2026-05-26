from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
from .models import TaskStatus, Conclusion, Node


class AcceptanceItem(BaseModel):
    item: str
    required: bool = True
    remark: Optional[str] = None


class CreateBatchRequest(BaseModel):
    project_name: str = Field(..., min_length=1)
    supervisor: str = Field(..., min_length=1)
    node: Node
    photos: List[str] = Field(default_factory=list)
    items: List[AcceptanceItem] = Field(default_factory=list)
    submitted_at: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class BatchResponse(BaseModel):
    id: int
    batch_no: str
    project_name: str
    supervisor: str
    node: Node
    status: TaskStatus
    conclusion: Conclusion
    photos: List[str]
    created_at: datetime
    updated_at: datetime
    duplicated: bool = False

    class Config:
        from_attributes = True


class ConfirmRequest(BaseModel):
    operator: str = Field(..., min_length=1)
    conclusion: Conclusion
    reason: str = Field(..., min_length=1)


class ReworkRequest(BaseModel):
    operator: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)


class ExportRequest(BaseModel):
    operator: str = Field(..., min_length=1)


class AuditResponse(BaseModel):
    id: int
    batch_no: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReworkStatResponse(BaseModel):
    node: Node
    rework_count: int

    class Config:
        from_attributes = True


class Message(BaseModel):
    detail: str
