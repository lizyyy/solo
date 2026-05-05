"""Data models for decorator analysis."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class DecoratorType(Enum):
    SIMPLE = "simple"
    WITH_ARGS = "with_args"
    FUNCTOOLS_WRAPS = "functools_wraps"
    CLASS_DECORATOR = "class_decorator"
    DESCRIPTOR = "descriptor"
    ASYNC = "async"
    STACKED = "stacked"


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskType(Enum):
    EXCEPTION_SWALLOW = "exception_swallow"
    METADATA_LOSS = "metadata_loss"
    SIGNATURE_CHANGE = "signature_change"
    RETURN_VALUE_ALTERED = "return_value_altered"
    ORDER_DEPENDENCY = "order_dependency"
    ASYNC_MISMATCH = "async_mismatch"
    DESCRIPTOR_BINDING = "descriptor_binding"


@dataclass
class FunctionMetadata:
    name: str
    module: str
    signature: str
    docstring: Optional[str] = None
    is_async: bool = False
    is_method: bool = False
    annotations: dict[str, Any] = field(default_factory=dict)


@dataclass
class DecoratorInfo:
    id: str
    name: str
    decorator_type: DecoratorType
    module: str
    line_number: int
    has_wraps: bool = False
    parameters: dict[str, Any] = field(default_factory=dict)
    source_code: Optional[str] = None


@dataclass
class DecoratedFunction:
    id: str
    function: FunctionMetadata
    decorators: list[DecoratorInfo] = field(default_factory=list)
    decorator_order: list[str] = field(default_factory=list)


@dataclass
class CallEvent:
    id: str
    function_id: str
    timestamp: datetime
    caller: Optional[str] = None
    args: tuple = field(default_factory=tuple)
    kwargs: dict[str, Any] = field(default_factory=dict)
    return_value: Optional[Any] = None
    exception: Optional[str] = None
    decorator_stack: list[str] = field(default_factory=list)
    duration_ms: Optional[float] = None


@dataclass
class Risk:
    id: str
    function_id: str
    decorator_id: Optional[str] = None
    risk_type: RiskType = RiskType.EXCEPTION_SWALLOW
    level: RiskLevel = RiskLevel.MEDIUM
    description: str = ""
    location: str = ""
    suggestion: str = ""


@dataclass
class SignatureCheck:
    function_id: str
    original_signature: str
    decorated_signature: str
    matches: bool = False
    differences: list[str] = field(default_factory=list)


@dataclass
class MetadataCheck:
    function_id: str
    original_name: str
    decorated_name: str
    original_docstring: Optional[str]
    decorated_docstring: Optional[str]
    name_preserved: bool = False
    docstring_preserved: bool = False
    uses_wraps: bool = False


@dataclass
class AnalysisResult:
    id: str
    timestamp: datetime
    decorated_functions: list[DecoratedFunction] = field(default_factory=list)
    call_events: list[CallEvent] = field(default_factory=list)
    risks: list[Risk] = field(default_factory=list)
    signature_checks: list[SignatureCheck] = field(default_factory=list)
    metadata_checks: list[MetadataCheck] = field(default_factory=list)
