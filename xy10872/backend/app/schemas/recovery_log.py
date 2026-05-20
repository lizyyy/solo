from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.recovery_log import LogLevel


class RecoveryLogBase(BaseModel):
    reset_request_id: int
    level: LogLevel = LogLevel.INFO
    message: str
    details: Optional[str] = None
    created_by: Optional[str] = None


class RecoveryLogCreate(RecoveryLogBase):
    pass


class RecoveryLog(RecoveryLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True