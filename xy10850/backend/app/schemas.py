from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EndpointStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEGRADED = "degraded"
    DISABLED = "disabled"
    ERROR = "error"


class DegradationStrategy(str, Enum):
    RETURN_CACHE = "return_cache"
    RETURN_DEFAULT = "return_default"
    SKIP_FIELD = "skip_field"
    RETURN_STATIC = "return_static"


class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class PageModuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    path: Optional[str] = None
    version: str = "1.0"
    status: EndpointStatus = EndpointStatus.DRAFT
    cache_enabled: bool = True
    cache_ttl: int = 300


class PageModuleCreate(PageModuleBase):
    pass


class PageModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    version: Optional[str] = None
    status: Optional[EndpointStatus] = None
    cache_enabled: Optional[bool] = None
    cache_ttl: Optional[int] = None


class PageModule(PageModuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class UpstreamApiBase(BaseModel):
    name: str
    base_url: str
    path: str
    method: HttpMethod = HttpMethod.GET
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    body_template: Optional[Dict[str, Any]] = None
    timeout: int = 30
    retry_count: int = 3
    circuit_breaker_enabled: bool = True
    failure_threshold: int = 5
    recovery_timeout: int = 60


class UpstreamApiCreate(UpstreamApiBase):
    pass


class UpstreamApiUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    path: Optional[str] = None
    method: Optional[HttpMethod] = None
    headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    body_template: Optional[Dict[str, Any]] = None
    timeout: Optional[int] = None
    retry_count: Optional[int] = None
    circuit_breaker_enabled: Optional[bool] = None
    failure_threshold: Optional[int] = None
    recovery_timeout: Optional[int] = None


class UpstreamApi(UpstreamApiBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EndpointUpstreamBase(BaseModel):
    upstream_api_id: int
    order: int = 0
    parallel: bool = False
    depends_on: Optional[List[int]] = None
    input_mapping: Optional[Dict[str, Any]] = None
    output_mapping: Optional[Dict[str, Any]] = None
    condition: Optional[str] = None
    required: bool = True


class EndpointUpstreamCreate(EndpointUpstreamBase):
    pass


class EndpointUpstream(EndpointUpstreamBase):
    id: int
    endpoint_id: int
    upstream_api: Optional[UpstreamApi] = None

    class Config:
        from_attributes = True


class AggregateFieldBase(BaseModel):
    name: str
    path: str
    source_type: Optional[str] = None
    source_upstream_id: Optional[int] = None
    source_path: Optional[str] = None
    transformation: Optional[Dict[str, Any]] = None
    default_value: Optional[Any] = None
    required: bool = False
    trim_enabled: bool = True


class AggregateFieldCreate(AggregateFieldBase):
    endpoint_id: Optional[int] = None
    page_module_id: Optional[int] = None


class AggregateField(AggregateFieldBase):
    id: int
    endpoint_id: Optional[int] = None
    page_module_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BffEndpointBase(BaseModel):
    name: str
    description: Optional[str] = None
    path: str
    method: HttpMethod = HttpMethod.GET
    page_module_id: Optional[int] = None
    status: EndpointStatus = EndpointStatus.DRAFT
    orchestration_rules: Optional[Dict[str, Any]] = None
    cache_enabled: bool = True
    cache_ttl: int = 300
    cache_key_template: Optional[str] = None
    degradation_strategy: DegradationStrategy = DegradationStrategy.RETURN_CACHE
    degradation_default_value: Optional[Dict[str, Any]] = None
    timeout: int = 30


class BffEndpointCreate(BffEndpointBase):
    upstreams: Optional[List[EndpointUpstreamCreate]] = None
    fields: Optional[List[AggregateFieldCreate]] = None


class BffEndpointUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    method: Optional[HttpMethod] = None
    page_module_id: Optional[int] = None
    status: Optional[EndpointStatus] = None
    orchestration_rules: Optional[Dict[str, Any]] = None
    cache_enabled: Optional[bool] = None
    cache_ttl: Optional[int] = None
    cache_key_template: Optional[str] = None
    degradation_strategy: Optional[DegradationStrategy] = None
    degradation_default_value: Optional[Dict[str, Any]] = None
    timeout: Optional[int] = None
    upstreams: Optional[List[EndpointUpstreamCreate]] = None
    fields: Optional[List[AggregateFieldCreate]] = None


class BffEndpoint(BffEndpointBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    upstreams: List[EndpointUpstream] = []
    fields: List[AggregateField] = []

    class Config:
        from_attributes = True


class CallHistoryBase(BaseModel):
    endpoint_id: int
    request_id: str
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    request_headers: Optional[Dict[str, Any]] = None
    request_query: Optional[Dict[str, Any]] = None
    request_body: Optional[Dict[str, Any]] = None
    response_status: Optional[int] = None
    response_body: Optional[Dict[str, Any]] = None
    response_time_ms: Optional[float] = None
    cache_hit: bool = False
    degraded: bool = False
    error_message: Optional[str] = None
    upstream_calls: Optional[List[Dict[str, Any]]] = None


class CallHistoryCreate(CallHistoryBase):
    pass


class CallHistory(CallHistoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    new_status: EndpointStatus
    reason: Optional[str] = None


class BatchImportResult(BaseModel):
    success_count: int
    failed_count: int
    errors: List[str] = []
    imported_ids: List[int] = []


class ExecuteRequest(BaseModel):
    endpoint_id: int
    request_data: Optional[Dict[str, Any]] = None
    skip_cache: bool = False
