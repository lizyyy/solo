from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class HttpLogResponse(BaseModel):
    id: int
    request_id: Optional[str]
    method: Optional[str]
    url: Optional[str]
    path: Optional[str]
    status_code: Optional[int]
    user_id: Optional[int]
    client_ip: Optional[str]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    duration_ms: Optional[int]
    has_error: int
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CommandLogResponse(BaseModel):
    id: int
    command_name: str
    command_script: str
    arguments: Optional[str]
    operator_id: Optional[int]
    operator_name: Optional[str]
    executed_at: datetime
    duration_ms: Optional[int]
    exit_code: Optional[int]
    success: int
    notes: Optional[str]

    class Config:
        from_attributes = True
