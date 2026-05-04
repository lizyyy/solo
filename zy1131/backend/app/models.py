from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime

class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"

class IssueStatus(str, Enum):
    OPEN = "open"
    CONFIRMED = "confirmed"
    FALSE_POSITIVE = "false_positive"
    RESOLVED = "resolved"

class Layer(str, Enum):
    TOP = "top"
    BOTTOM = "bottom"
    INTERNAL = "internal"

class ComponentType(str, Enum):
    RESISTOR = "resistor"
    CAPACITOR = "capacitor"
    INDUCTOR = "inductor"
    IC = "ic"
    CONNECTOR = "connector"
    DIODE = "diode"
    LED = "led"
    TRANSISTOR = "transistor"
    FUSE = "fuse"
    SWITCH = "switch"
    OTHER = "other"

class Point(BaseModel):
    x: float
    y: float

class Rectangle(BaseModel):
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0.0

class Circle(BaseModel):
    x: float
    y: float
    radius: float

class Pad(BaseModel):
    id: str
    shape: str = "rectangle"
    x: float
    y: float
    width: float
    height: float
    radius: Optional[float] = None
    rotation: float = 0.0
    layer: Layer = Layer.TOP
    net_name: Optional[str] = None
    is_smd: bool = True
    is_through_hole: bool = False
    hole_diameter: Optional[float] = None

class Via(BaseModel):
    id: str
    x: float
    y: float
    drill_diameter: float
    pad_diameter: float
    start_layer: Layer = Layer.TOP
    end_layer: Layer = Layer.BOTTOM
    net_name: Optional[str] = None
    is_plated: bool = True

class Track(BaseModel):
    id: str
    start_x: float
    start_y: float
    end_x: float
    end_y: float
    width: float
    layer: Layer = Layer.TOP
    net_name: Optional[str] = None
    is_trace: bool = True

class Component(BaseModel):
    id: str
    reference: str
    part_number: str
    footprint: str
    description: str
    component_type: ComponentType = ComponentType.OTHER
    x: float
    y: float
    rotation: float = 0.0
    layer: Layer = Layer.TOP
    is_polar: bool = False
    polarity_direction: Optional[str] = None
    power_dissipation: Optional[float] = None
    height: Optional[float] = None
    pads: List[Pad] = []
    silk_screen: Optional[str] = None
    assembly_layer: Optional[str] = None

class SilkScreenItem(BaseModel):
    id: str
    type: str = "text"
    x: float
    y: float
    text: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    layer: Layer = Layer.TOP
    rotation: float = 0.0

class BoardOutline(BaseModel):
    width: float
    height: float
    origin_x: float = 0.0
    origin_y: float = 0.0
    keepout_zones: List[Dict[str, Any]] = []

class PCBData(BaseModel):
    name: str = "Untitled Board"
    version: str = "1.0"
    units: str = "mm"
    board_outline: BoardOutline
    components: List[Component] = []
    pads: List[Pad] = []
    vias: List[Via] = []
    tracks: List[Track] = []
    silk_screen: List[SilkScreenItem] = []
    copper_areas: List[Dict[str, Any]] = []
    keepout_zones: List[Dict[str, Any]] = []
    net_list: List[str] = []
    critical_nets: List[str] = []

class BOMItem(BaseModel):
    reference: str
    part_number: str
    description: str = ""
    footprint: str = ""
    quantity: int = 1
    manufacturer: str = ""
    value: str = ""
    voltage_rating: Optional[str] = None
    tolerance: Optional[str] = None
    package: Optional[str] = None
    is_available: bool = True
    alternate_part_numbers: List[str] = []

class Rule(BaseModel):
    id: str
    name: str
    category: str
    description: str
    severity: IssueSeverity = IssueSeverity.WARNING
    enabled: bool = True
    parameters: Dict[str, Any] = {}

class RuleSet(BaseModel):
    name: str = "Default Rules"
    version: str = "1.0"
    description: str = "默认PCB设计规则集"
    rules: List[Rule] = []

class IssueLocation(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    layer: Optional[str] = None
    reference: Optional[str] = None
    net_name: Optional[str] = None
    affected_elements: List[str] = []

class Issue(BaseModel):
    id: str
    rule_id: str
    rule_name: str
    category: str
    severity: IssueSeverity
    status: IssueStatus = IssueStatus.OPEN
    title: str
    description: str
    suggestion: str
    location: IssueLocation
    created_at: str
    updated_at: Optional[str] = None
    notes: List[str] = []

class Statistics(BaseModel):
    total: int = 0
    critical: int = 0
    warning: int = 0
    info: int = 0
    open: int = 0
    confirmed: int = 0
    false_positive: int = 0
    resolved: int = 0

class Summary(BaseModel):
    board_name: str
    check_timestamp: str
    components_checked: int
    nets_checked: int
    rules_applied: int
    rules_passed: int
    rules_failed: int

class CheckResult(BaseModel):
    version_id: str
    timestamp: str
    issues: List[Issue] = []
    statistics: Statistics = Statistics()
    summary: Summary

class VersionInfo(BaseModel):
    version_id: str
    timestamp: str
    issue_count: int
    critical_count: int
    warning_count: int
    info_count: int
    comment: Optional[str] = None

class ImportResult(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    errors: List[str] = []

class RuleUpdateRequest(BaseModel):
    enabled: bool
    parameters: Dict[str, Any]

class IssueStatusUpdate(BaseModel):
    status: IssueStatus
    notes: Optional[str] = None

class ReportExportRequest(BaseModel):
    version_id: str
    format: str = "json"
    include_resolved: bool = False
    include_notes: bool = True
