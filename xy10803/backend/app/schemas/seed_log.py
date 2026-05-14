from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from .common import BaseSchema


class SeedLogBase(BaseModel):
    batch_id: int
    template_id: int
    action: str
    status: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    sql_executed: Optional[str] = None
    error_message: Optional[str] = None
    executed_at: Optional[datetime] = None
    duration_ms: int = 0


class SeedLogCreate(SeedLogBase):
    pass


class SeedLogSchema(SeedLogBase, BaseSchema):
    pass
