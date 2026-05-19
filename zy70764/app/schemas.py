from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class CollectionBase(BaseModel):
    name: str
    postman_id: Optional[str] = None
    schema_version: Optional[str] = None


class CollectionCreate(CollectionBase):
    raw_content: Dict[str, Any]


class CollectionResponse(CollectionBase):
    id: int
    status: str
    total_requests: int
    requests_with_assertions: int
    requests_with_examples: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequestBase(BaseModel):
    name: str
    method: str
    url: str
    path: str
    folder_path: str


class RequestResponse(RequestBase):
    id: int
    collection_id: int
    has_assertions: bool
    has_examples: bool
    assertion_count: int
    example_count: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RequestDetail(RequestResponse):
    assertions: List["AssertionResponse"]
    examples: List["ExampleResponse"]
    variables: List["VariableResponse"]
    audit_logs: List["AuditLogResponse"]


class AssertionBase(BaseModel):
    type: str
    content: str
    line_number: int
    is_valid: bool = True


class AssertionResponse(AssertionBase):
    id: int
    request_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExampleBase(BaseModel):
    name: str
    status_code: int
    content_type: str
    body: str


class ExampleResponse(ExampleBase):
    id: int
    request_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VariableBase(BaseModel):
    name: str
    context: str
    line_number: int
    is_resolved: bool = False


class VariableResponse(VariableBase):
    id: int
    request_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    handler: str
    conclusion: str
    raw_input: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    request_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    type: str
    status: str = "generated"
    content: Dict[str, Any]
    generated_by: str


class ReportResponse(ReportBase):
    id: int
    collection_id: int
    file_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    request_id: int
    new_status: str
    handler: str
    conclusion: str
    raw_input: Optional[str] = None


class CollectionUploadResponse(BaseModel):
    collection_id: int
    message: str
    total_requests: int
    requests_without_assertions: int
    requests_without_examples: int


class CoverageStats(BaseModel):
    collection_id: int
    collection_name: str
    total_requests: int
    assertion_coverage: float
    example_coverage: float
    requests_without_assertions: int
    requests_without_examples: int
    total_variables: int
    unresolved_variables: int


RequestDetail.model_rebuild()
