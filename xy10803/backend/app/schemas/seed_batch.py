from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from .common import BaseSchema


class SeedBatchBase(BaseModel):
    sandbox_id: int
    template_id: int
    parameters: Dict[str, Any] = {}
    created_by: Optional[str] = None


class SeedBatchCreate(SeedBatchBase):
    pass


class SeedBatchUpdate(BaseModel):
    status: Optional[str] = None
    result_summary: Optional[Dict[str, Any]] = None
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    is_idempotent: Optional[int] = None


class SeedBatchSchema(SeedBatchBase, BaseSchema):
    batch_no: str
    status: str
    result_summary: Dict[str, Any] = {}
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    is_idempotent: int
