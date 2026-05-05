"""Data models for descriptor inspection."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class DescriptorType(Enum):
    """Type of descriptor."""
    DATA_DESCRIPTOR = "data_descriptor"
    NON_DATA_DESCRIPTOR = "non_data_descriptor"
    PROPERTY = "property"
    CACHED_PROPERTY = "cached_property"
    NOT_A_DESCRIPTOR = "not_a_descriptor"


class EventType(Enum):
    """Type of event captured."""
    GET = "__get__"
    SET = "__set__"
    DELETE = "__delete__"
    SET_NAME = "__set_name__"
    INSTANCE_DICT_ACCESS = "instance_dict_access"
    VALIDATION_ERROR = "validation_error"
    ATTRIBUTE_ERROR = "attribute_error"


@dataclass
class DescriptorCase:
    """A test case for descriptor behavior."""
    id: str
    name: str
    description: str
    descriptor_type: DescriptorType
    code_snippet: str
    expected_behavior: Dict[str, Any]
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Event:
    """An event captured during descriptor operation."""
    id: int
    timestamp: datetime
    event_type: EventType
    descriptor_name: str
    instance_type: str
    owner_class: str
    value: Optional[Any] = None
    exception: Optional[str] = None
    call_stack: Optional[List[str]] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    """Result of a descriptor analysis."""
    case_id: str
    descriptor_type: DescriptorType
    events: List[Event]
    priority_observed: str
    instance_dict_coverage: bool
    get_called: bool
    set_called: bool
    delete_called: bool
    set_name_called: bool
    validation_errors: List[str]
    property_vs_cached_diff: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    analyzed_at: datetime = field(default_factory=datetime.now)


@dataclass
class ComparisonResult:
    """Result of comparing two descriptor behaviors."""
    case1_id: str
    case2_id: str
    differences: List[Dict[str, Any]]
    similarities: List[Dict[str, Any]]
    key_insights: List[str]
    compared_at: datetime = field(default_factory=datetime.now)


@dataclass
class ValidationError:
    """A validation error encountered during processing."""
    file_path: str
    line_number: int
    error_type: str
    message: str
    suggestion: Optional[str] = None
    context: Optional[str] = None
