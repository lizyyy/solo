from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import ValidationStatus, ErrorCategory


class DocumentPageBase(BaseModel):
    url: str = Field(..., max_length=500)
    title: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = True


class DocumentPageCreate(DocumentPageBase):
    content_hash: str = Field(..., max_length=64)


class DocumentPageUpdate(BaseModel):
    url: Optional[str] = Field(None, max_length=500)
    title: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class DocumentPageResponse(DocumentPageBase):
    id: int
    content_hash: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RequestExampleBase(BaseModel):
    name: str = Field(..., max_length=200)
    method: str = Field(..., max_length=10)
    url: str = Field(..., max_length=1000)
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    expected_status: Optional[int] = None
    expected_response: Optional[str] = None
    is_active: Optional[bool] = True


class RequestExampleCreate(RequestExampleBase):
    document_page_id: Optional[int] = None
    content_hash: str = Field(..., max_length=64)


class RequestExampleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    method: Optional[str] = Field(None, max_length=10)
    url: Optional[str] = Field(None, max_length=1000)
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    expected_status: Optional[int] = None
    expected_response: Optional[str] = None
    is_active: Optional[bool] = None


class RequestExampleResponse(RequestExampleBase):
    id: int
    document_page_id: Optional[int]
    content_hash: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class EnvironmentVariableBase(BaseModel):
    key: str = Field(..., max_length=100)
    value: str
    description: Optional[str] = Field(None, max_length=500)
    is_secret: Optional[bool] = False


class EnvironmentVariableCreate(EnvironmentVariableBase):
    pass


class EnvironmentVariableUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    is_secret: Optional[bool] = None


class EnvironmentVariableResponse(BaseModel):
    id: int
    key: str
    description: Optional[str]
    is_secret: bool
    value: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ErrorCauseResponse(BaseModel):
    id: int
    category: ErrorCategory
    message: str
    details: Optional[Dict[str, Any]]
    suggested_fix: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationResultBase(BaseModel):
    status: ValidationStatus = ValidationStatus.PENDING


class ValidationResultCreate(BaseModel):
    example_id: int


class ValidationResultResponse(BaseModel):
    id: int
    example_id: int
    status: ValidationStatus
    actual_status: Optional[int]
    actual_response: Optional[str]
    response_time_ms: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    error_cause: Optional[ErrorCauseResponse] = None

    class Config:
        from_attributes = True


class ValidationResultDetailResponse(ValidationResultResponse):
    example: RequestExampleResponse


class FixTraceBase(BaseModel):
    action_taken: str
    operator: str = Field(..., max_length=100)
    remark: Optional[str] = None


class FixTraceCreate(FixTraceBase):
    validation_result_id: int


class FixTraceResponse(FixTraceBase):
    id: int
    validation_result_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ValidationRequest(BaseModel):
    example_id: Optional[int] = None
    example_ids: Optional[List[int]] = None
    document_page_id: Optional[int] = None
    environment: Optional[Dict[str, str]] = None


class ValidationBatchRequest(BaseModel):
    example_ids: List[int]
    environment: Optional[Dict[str, str]] = None


class StatusUpdateRequest(BaseModel):
    status: ValidationStatus
    remark: Optional[str] = None
    operator: Optional[str] = "system"


class APIError(BaseModel):
    code: int
    message: str
    details: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]
