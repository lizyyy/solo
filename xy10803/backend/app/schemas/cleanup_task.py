from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from .common import BaseSchema


class CleanupTaskBase(BaseModel):
    sandbox_id: int
    batch_id: Optional[int] = None
    cleanup_type: str = "rollback"
    cleanup_strategy: Dict[str, Any] = {}


class CleanupTaskCreate(CleanupTaskBase):
    pass


class CleanupTaskUpdate(BaseModel):
    status: Optional[str] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_summary: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class CleanupTaskSchema(CleanupTaskBase, BaseSchema):
    status: str
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result_summary: Dict[str, Any] = {}
    error_message: Optional[str] = None
