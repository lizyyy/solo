"""Data models for metaclass analysis."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class EventType(Enum):
    """Types of metaclass-related events."""
    PREPARE = "__prepare__"
    METACLASS_SELECT = "metaclass_select"
    NEW = "__new__"
    INIT = "__init__"
    SET_NAME = "__set_name__"
    INIT_SUBCLASS = "__init_subclass__"
    MRO_COMPUTE = "mro_compute"
    METACLASS_CONFLICT = "metaclass_conflict"
    CLASS_CREATED = "class_created"


@dataclass
class Event:
    """Represents a single event in the class creation timeline."""
    event_type: EventType
    timestamp: datetime
    class_name: str
    metaclass_name: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    order: int = 0
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class FieldInfo:
    """Information about a class field/attribute."""
    name: str
    value: Any
    defined_in_class: str
    order: int
    descriptor_type: Optional[str] = None
    set_name_called: bool = False


@dataclass
class ClassInfo:
    """Complete information about a class definition."""
    name: str
    bases: List[str]
    metaclass: str
    mro: List[str]
    fields: List[FieldInfo] = field(default_factory=list)
    events: List[Event] = field(default_factory=list)
    has_conflict: bool = False
    conflict_details: Optional[str] = None
    source_file: Optional[str] = None
    defined_at: Optional[datetime] = None


@dataclass
class ConflictInfo:
    """Information about a metaclass conflict."""
    class_name: str
    bases: List[str]
    base_metaclasses: Dict[str, str]
    suggested_metaclass: Optional[str] = None
    resolution_steps: List[str] = field(default_factory=list)
    severity: str = "error"


@dataclass
class AnalysisResult:
    """Result of a complete metaclass analysis."""
    classes: Dict[str, ClassInfo] = field(default_factory=dict)
    conflicts: List[ConflictInfo] = field(default_factory=list)
    timeline: List[Event] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
