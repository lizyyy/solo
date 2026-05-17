from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class ExchangeType(str, Enum):
    DIRECT = "direct"
    TOPIC = "topic"
    FANOUT = "fanout"
    HEADERS = "headers"
    CONSISTENT_HASH = "x-consistent-hash"


class Exchange(BaseModel):
    name: str
    vhost: str = "/"
    type: ExchangeType = ExchangeType.DIRECT
    durable: bool = True
    auto_delete: bool = False
    internal: bool = False
    arguments: Dict[str, Any] = Field(default_factory=dict)


class Queue(BaseModel):
    name: str
    vhost: str = "/"
    durable: bool = True
    auto_delete: bool = False
    exclusive: bool = False
    arguments: Dict[str, Any] = Field(default_factory=dict)


class Binding(BaseModel):
    source: str
    destination: str
    destination_type: str = "queue"
    routing_key: str = ""
    vhost: str = "/"
    arguments: Dict[str, Any] = Field(default_factory=dict)


class Policy(BaseModel):
    name: str
    vhost: str = "/"
    pattern: str
    definition: Dict[str, Any]
    priority: int = 0
    apply_to: str = "all"


class ValidationError(BaseModel):
    line_number: Optional[int] = None
    field: Optional[str] = None
    value: Optional[str] = None
    error_type: str
    message: str
    raw_data: Optional[str] = None


class TopologyData(BaseModel):
    exchanges: List[Exchange] = Field(default_factory=list)
    queues: List[Queue] = Field(default_factory=list)
    bindings: List[Binding] = Field(default_factory=list)
    policies: List[Policy] = Field(default_factory=list)
    errors: List[ValidationError] = Field(default_factory=list)


class ValidationResult(BaseModel):
    orphan_queues: List[str] = Field(default_factory=list)
    orphan_exchanges: List[str] = Field(default_factory=list)
    invalid_bindings: List[Dict[str, Any]] = Field(default_factory=list)
    duplicate_bindings: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
