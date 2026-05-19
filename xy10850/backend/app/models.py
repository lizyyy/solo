from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum


class EndpointStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEGRADED = "degraded"
    DISABLED = "disabled"
    ERROR = "error"


class DegradationStrategy(str, enum.Enum):
    RETURN_CACHE = "return_cache"
    RETURN_DEFAULT = "return_default"
    SKIP_FIELD = "skip_field"
    RETURN_STATIC = "return_static"


class HttpMethod(str, enum.Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class PageModule(Base):
    __tablename__ = "page_modules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    path = Column(String(255), index=True)
    version = Column(String(50), default="1.0")
    status = Column(String(50), default=EndpointStatus.DRAFT)
    cache_enabled = Column(Boolean, default=True)
    cache_ttl = Column(Integer, default=300)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100))

    endpoints = relationship("BffEndpoint", back_populates="page_module", cascade="all, delete-orphan")
    fields = relationship("AggregateField", back_populates="page_module", cascade="all, delete-orphan")


class UpstreamApi(Base):
    __tablename__ = "upstream_apis"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    base_url = Column(String(255), nullable=False)
    path = Column(String(255), nullable=False)
    method = Column(String(20), default=HttpMethod.GET)
    headers = Column(JSON)
    query_params = Column(JSON)
    body_template = Column(JSON)
    timeout = Column(Integer, default=30)
    retry_count = Column(Integer, default=3)
    circuit_breaker_enabled = Column(Boolean, default=True)
    failure_threshold = Column(Integer, default=5)
    recovery_timeout = Column(Integer, default=60)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    endpoints = relationship("EndpointUpstream", back_populates="upstream_api")


class BffEndpoint(Base):
    __tablename__ = "bff_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    path = Column(String(255), nullable=False, index=True)
    method = Column(String(20), default=HttpMethod.GET)
    page_module_id = Column(Integer, ForeignKey("page_modules.id"))
    status = Column(String(50), default=EndpointStatus.DRAFT)
    orchestration_rules = Column(JSON)
    cache_enabled = Column(Boolean, default=True)
    cache_ttl = Column(Integer, default=300)
    cache_key_template = Column(String(500))
    degradation_strategy = Column(String(50), default=DegradationStrategy.RETURN_CACHE)
    degradation_default_value = Column(JSON)
    timeout = Column(Integer, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100))

    page_module = relationship("PageModule", back_populates="endpoints")
    upstreams = relationship("EndpointUpstream", back_populates="endpoint", cascade="all, delete-orphan")
    fields = relationship("AggregateField", back_populates="endpoint", cascade="all, delete-orphan")
    call_history = relationship("CallHistory", back_populates="endpoint", cascade="all, delete-orphan")


class EndpointUpstream(Base):
    __tablename__ = "endpoint_upstreams"

    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("bff_endpoints.id"), nullable=False)
    upstream_api_id = Column(Integer, ForeignKey("upstream_apis.id"), nullable=False)
    order = Column(Integer, default=0)
    parallel = Column(Boolean, default=False)
    depends_on = Column(JSON)
    input_mapping = Column(JSON)
    output_mapping = Column(JSON)
    condition = Column(String(500))
    required = Column(Boolean, default=True)

    endpoint = relationship("BffEndpoint", back_populates="upstreams")
    upstream_api = relationship("UpstreamApi", back_populates="endpoints")


class AggregateField(Base):
    __tablename__ = "aggregate_fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    path = Column(String(255), nullable=False)
    endpoint_id = Column(Integer, ForeignKey("bff_endpoints.id"))
    page_module_id = Column(Integer, ForeignKey("page_modules.id"))
    source_type = Column(String(50))
    source_upstream_id = Column(Integer, ForeignKey("upstream_apis.id"))
    source_path = Column(String(255))
    transformation = Column(JSON)
    default_value = Column(JSON)
    required = Column(Boolean, default=False)
    trim_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    endpoint = relationship("BffEndpoint", back_populates="fields")
    page_module = relationship("PageModule", back_populates="fields")


class CallHistory(Base):
    __tablename__ = "call_history"

    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(Integer, ForeignKey("bff_endpoints.id"), nullable=False)
    request_id = Column(String(100), index=True)
    request_method = Column(String(20))
    request_path = Column(String(255))
    request_headers = Column(JSON)
    request_query = Column(JSON)
    request_body = Column(JSON)
    response_status = Column(Integer)
    response_body = Column(JSON)
    response_time_ms = Column(Float)
    cache_hit = Column(Boolean, default=False)
    degraded = Column(Boolean, default=False)
    error_message = Column(Text)
    upstream_calls = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    endpoint = relationship("BffEndpoint", back_populates="call_history")


class CacheEntry(Base):
    __tablename__ = "cache_entries"

    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(500), unique=True, index=True, nullable=False)
    endpoint_id = Column(Integer, ForeignKey("bff_endpoints.id"))
    value = Column(JSON)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    hit_count = Column(Integer, default=0)
