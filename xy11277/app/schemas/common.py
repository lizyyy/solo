from typing import Generic, List, Optional, TypeVar, Any
from pydantic import BaseModel, Field
from datetime import date, datetime

T = TypeVar('T')


class BatchResult(BaseModel, Generic[T]):
    success_count: int = 0
    failure_count: int = 0
    successful: List[T] = Field(default_factory=list)
    failed: List[dict] = Field(default_factory=list)


class APIResponse(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class IdempotentRequest(BaseModel):
    idempotency_key: str = Field(..., description="幂等性键，用于防止重复提交")


class DateRange(BaseModel):
    start_date: date
    end_date: date
