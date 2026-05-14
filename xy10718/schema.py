from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SlowQueryCreate(BaseModel):
    fingerprint: str
    sql_content: str
    execution_time: float
    rows_examined: int
    rows_sent: int
    database: str
    affected_endpoints: Optional[str] = None
    owner: Optional[str] = None
    priority: Optional[str] = "medium"

class SlowQueryResponse(BaseModel):
    id: int
    fingerprint: str
    sql_content: str
    execution_time: float
    rows_examined: int
    rows_sent: int
    database: str
    affected_endpoints: Optional[str]
    execution_plan: Optional[str]
    index_suggestion: Optional[str]
    owner: Optional[str]
    status: str
    priority: str
    is_valid: bool
    validation_error: Optional[str]
    created_at: datetime
    updated_at: datetime
    optimized_at: Optional[datetime]
    optimization_notes: Optional[str]

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    changed_by: str

class BatchImportResult(BaseModel):
    success: int
    failed: int
    errors: List[str]

class ExportFilter(BaseModel):
    owner: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
