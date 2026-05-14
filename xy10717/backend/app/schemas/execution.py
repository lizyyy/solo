from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.execution import ExecutionType, ExecutionStatus

class ExecutionLogBase(BaseModel):
    execution_type: ExecutionType
    executed_by: Optional[str] = None
    script_content: Optional[str] = None
    remarks: Optional[str] = None

class ExecutionLogCreate(ExecutionLogBase):
    migration_id: int

class ExecutionLogResponse(ExecutionLogBase):
    id: int
    migration_id: int
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    output: Optional[str] = None
    error_message: Optional[str] = None
    affected_rows: Optional[int] = None
    duration_seconds: Optional[int] = None
    parent_log_id: Optional[int] = None

    class Config:
        from_attributes = True